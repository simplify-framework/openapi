// @ts-nocheck

'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');

const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const Hogan = require('hogan.js');
const clone = require('reftools/lib/clone.js').circularClone; // must preserve functions

const adaptor = require('./adaptor.js');
const lambdas = require('./lambdas.js');

// allows other backends, such as a stream writer for .tar.gz files
let ff = {
    readFileSync: fs.readFileSync,
    createFile: fs.writeFileSync,
    rimraf: rimraf,
    mkdirp: mkdirp
};

function tpl(config, ...segments) {
    if (config.templateDir) {
        segments.splice(0, 1);
        return path.join(config.templateDir, ...segments);
    }
    return path.join(__dirname, 'templates', ...segments)
}

function main(o, config, configName, callback) {
    let outputDir = config.outputDir || './out/';
    let verbose = config.defaults.verbose;
    config.defaults.configName = configName;
    adaptor.transform(o, config.defaults, function (err, model) {
        if (config.generator) {
            model.generator = config.generator;
        }
        if (verbose) console.log('Processing lambdas ' + Object.keys(lambdas));
        Object.keys(lambdas).forEach(key => model[key] = lambdas[key]);

        if (config.generator && config.generator.lambdas) {
            for (let lambda in config.generator.lambdas) {
                if (verbose) console.log('Processing lambda ' + lambda);
                model[lambda] = config.generator.lambdas[lambda];
            }
        }
        for (let p in config.partials) {
            let partial = config.partials[p];
            if (verbose) console.log('Processing partial ' + partial);
            config.partials[p] = ff.readFileSync(tpl(config, configName, partial), 'utf8');
        }
        let services = {}
        model.apiInfo.apis.map((item) => {
            if (!services[item.serviceName]) {
                services[item.serviceName] = []
            }
            services[item.serviceName].push(item)
        })
        var setOfServices = {
            services: Object.keys(services).map((serviceName, index) => {
                var operations = {}
                services[serviceName].map(s => {
                    var operation = s.operations.operation.length > 0 ? s.operations.operation[0] : ''
                    if (!operations[operation.path]) {
                        operations[operation.path] = {
                            className: s.className,
                            data: []
                        }
                    }
                    operations[operation.path].data.push(operation)
                })
                return {
                    serviceName: serviceName,
                    service: {
                        operations: Object.keys(operations).map((opPath, index) => {
                            var ops = operations[opPath].data
                            var hasOptions = ops.some(op => op.httpMethodCase == 'post' || op.httpMethodCase == 'put' || op.httpMethodCase == 'patch')
                            return {
                                path: opPath,
                                className: operations[opPath].className,
                                hasOptions: hasOptions,
                                operation: ops
                            }
                        })
                    }
                }
            })
        }
        let actions = [];
        for (let t in config.transformations) {
            let tx = config.transformations[t];
            if (tx.input) {
                if (verbose) console.log('Processing template ' + tx.input);
                tx.template = ff.readFileSync(tpl(config, configName, tx.input), 'utf8');
            }
            actions.push(tx);
        }

        const subDir = (config.defaults.flat ? '' : configName);

        if (verbose) console.log('Making/cleaning output directories');
        ff.mkdirp(path.join(outputDir, subDir), function () {
            ff.rimraf(path.join(outputDir, subDir) + '/*', function () {
                if (config.directories) {
                    setOfServices.services.map(item => {
                        let params = Object.assign({}, model, item)
                        for (let directory of config.directories) {
                            let fnTemplate = Hogan.compile(directory);
                            let filename = fnTemplate.render(params);
                            ff.mkdirp.sync(path.join(outputDir, subDir, filename));
                        }
                    })
                }
                let outer = model;
                if (config.perGateway) {
                    let toplevel = clone(model);
                    delete toplevel.apiInfo;
                    for (let gw of config.perGateway) {
                        let fnTemplate = Hogan.compile(gw.output);
                        let template = Hogan.compile(ff.readFileSync(tpl(config, configName, gw.input), 'utf8'));
                        let cServices = Object.assign({}, config.defaults, gw.defaults || {}, toplevel, setOfServices);
                        let filename = fnTemplate.render(cServices, config.partials);
                        ff.mkdirp.sync(path.join(outputDir, subDir));
                        ff.createFile(path.join(outputDir, subDir, filename), template.render(cServices, config.partials), 'utf8');
                    }
                }
                for (let action of actions) {
                    if (verbose) console.log('Rendering ' + action.output);
                    let template = Hogan.compile(action.template);
                    let cServices = Object.assign({}, model, setOfServices)
                    let content = template.render(cServices, config.partials);
                    ff.createFile(path.join(outputDir, subDir, action.output), content, 'utf8');
                }
                if (config.touch) { // may not now be necessary
                    let touchTmp = Hogan.compile(config.touch);
                    let touchList = touchTmp.render(model, config.partials);
                    let files = touchList.split('\r').join('').split('\n');
                    for (let file of files) {
                        file = file.trim();
                        if (file) {
                            if (!fs.existsSync(path.join(outputDir, subDir, file))) {
                                ff.createFile(path.join(outputDir, subDir, file), '', 'utf8');
                            }
                        }
                    }
                }
                if (config.apache) {
                    ff.createFile(path.join(outputDir, subDir, 'LICENSE'), ff.readFileSync(tpl({}, '_common', 'LICENSE'), 'utf8'), 'utf8');
                }
                else {
                    ff.createFile(path.join(outputDir, subDir, 'LICENSE'), ff.readFileSync(tpl({}, '_common', 'UNLICENSE'), 'utf8'), 'utf8');
                }
                if (config.perService) {
                    let toplevel = clone(model);
                    delete toplevel.apiInfo;
                    for (let ps of config.perService) {
                        let fnTemplate = Hogan.compile(ps.output);
                        setOfServices.services.forEach(svc => {                            
                            let template = Hogan.compile(ff.readFileSync(tpl(config, configName, ps.input), 'utf8'));
                            let cServices = Object.assign({}, config.defaults, ps.defaults || {}, toplevel, svc);
                            let filename = fnTemplate.render(cServices, config.partials);
                            ff.mkdirp.sync(path.join(outputDir, subDir));
                            ff.createFile(path.join(outputDir, subDir, filename), template.render(cServices, config.partials), 'utf8');
                        })
                    }
                }
                if (config.perApi) {
                    let toplevel = clone(model);
                    delete toplevel.apiInfo;
                    for (let pa of config.perApi) {
                        let fnTemplate = Hogan.compile(pa.output);
                        let template = Hogan.compile(ff.readFileSync(tpl(config, configName, pa.input), 'utf8'));
                        for (let api of model.apiInfo.apis) {
                            let cApi = Object.assign({}, config.defaults, pa.defaults || {}, toplevel, api);
                            let filename = fnTemplate.render(cApi, config.partials);
                            if (verbose) console.log('Rendering ' + filename + ' (dynamic:' + pa.input + ')');
                            ff.createFile(path.join(outputDir, subDir, filename), template.render(cApi, config.partials), 'utf8');
                        }
                    }
                }

                if (config.perPath) {
                    let toplevel = clone(model);
                    delete toplevel.apiInfo;
                    for (let pa of config.perPath) {
                        let fnTemplate = Hogan.compile(pa.output);
                        let template = Hogan.compile(ff.readFileSync(tpl(config, configName, pa.input), 'utf8'));
                        for (let pat of model.apiInfo.paths) {
                            let cPath = Object.assign({}, config.defaults, pa.defaults || {}, toplevel, pat);
                            let filename = fnTemplate.render(cPath, config.partials);
                            let dirname = path.dirname(filename);
                            if (verbose) console.log('Rendering ' + filename + ' (dynamic:' + pa.input + ')');
                            ff.mkdirp.sync(path.join(outputDir, subDir));
                            ff.createFile(path.join(outputDir, subDir, filename), template.render(cPath, config.partials), 'utf8');
                        }
                    }
                }
                if (config.perModel) {
                    let cModels = clone(model.models);
                    for (let pm of config.perModel) {
                        let fnTemplate = Hogan.compile(pm.output);
                        let template = Hogan.compile(ff.readFileSync(tpl(config, configName, pm.input), 'utf8'));
                        for (let model of cModels) {
                            outer.models = [];
                            let effModel = Object.assign({}, model, pm.defaults || {});
                            outer.models.push(effModel);
                            let filename = fnTemplate.render(outer, config.partials);
                            if (verbose) console.log('Rendering ' + filename + ' (dynamic:' + pm.input + ')');
                            ff.createFile(path.join(outputDir, subDir, filename), template.render(outer, config.partials), 'utf8');
                        }
                    }
                }
                if (config.perOperation) {
                    for (let po of config.perOperation) {
                        let toplevel = clone(model);
                        delete toplevel.apiInfo;
                        let fnTemplate = Hogan.compile(po.output);
                        setOfServices.services.forEach(svc => {
                            let template = Hogan.compile(ff.readFileSync(tpl(config, configName, po.input), 'utf8'));
                            for (let operation of svc.service.operations) {
                                let cServices = Object.assign({}, config.defaults, po.defaults || {}, toplevel, svc, operation);
                                let filename = fnTemplate.render(cServices, config.partials);
                                ff.mkdirp.sync(path.join(outputDir, subDir));
                                ff.createFile(path.join(outputDir, subDir, filename), template.render(cServices, config.partials), 'utf8');
                            }
                        })
                    }
                }
                if (callback) callback(null, true);
            });
        });
    });
}

module.exports = {
    fileFunctions: ff,
    main: main
};

