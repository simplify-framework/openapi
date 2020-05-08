// @ts-nocheck

'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const Hogan = require('hogan.js');
const clone = require('reftools/lib/clone.js').circularClone;

const adaptor = require('./adaptor.js');

let ff = {
    readFileSync: fs.readFileSync,
    createFile: fs.writeFileSync,
    existsSync: fs.existsSync,
    rimraf: rimraf,
    mkdirp: mkdirp
};

function tpl(...segments) {
    return path.join(__dirname, 'boilerplates', ...segments)
}

function main(o, config, callback) {
    let outputDir = path.join(config.outputDir || './out/');
    let verbose = config.defaults.verbose;
    let cleanUp = config.cleanUp || false;
    let templateFolder = 'application';
    adaptor.transform(o, config.defaults, function (err, model) {
        const subDir = (config.defaults.flat ? '' : templateFolder);
        let actions = [];
        if (verbose) logger.info('Making/cleaning output directories');
        var outputDirPath = path.join(outputDir, subDir)
        if (!err) {
            ff.mkdirp(outputDirPath).then(function () {
                if (cleanUp) {
                    ff.rimraf(outputDirPath + '/*', function () {
                        generate()
                    });
                } else {
                    generate()
                }
            });
        } else {
            callback && callback(err, null)
        }
        function generate() {
            for (let action of actions) {
                if (verbose) logger.info('Rendering ' + action.output);
                let template = Hogan.compile(action.template);
                let cServices = Object.assign({}, model, model.apiInfo)
                let content = template.render(cServices, config.partials);
                let requestDir = require('path').dirname(path.join(outputDir, subDir, action.output))
                if (!ff.existsSync(requestDir)) {
                    ff.mkdirp.sync(requestDir);
                }
                if (verbose) logger.info("Generating...", path.join(outputDir, subDir, action.output))
                ff.createFile(path.join(outputDir, subDir, action.output), content, 'utf8');
            }
            if (config.ApiGateway) {
                let toplevel = clone(model);
                delete toplevel.apiInfo;
                templateFolder = 'api-gateway';
                for (let gw of config.ApiGateway) {
                    let fnTemplate = Hogan.compile(gw.output);
                    let template = Hogan.compile(ff.readFileSync(tpl(templateFolder, gw.input), 'utf8'));
                    let rootModel = Object.assign({}, config.defaults, gw.defaults || {}, toplevel, model.apiInfo, config.apis);
                    let filename = fnTemplate.render(rootModel, config.partials);
                    let requestDir = require('path').dirname(path.join(outputDir, subDir, filename))
                    if (!ff.existsSync(requestDir)) {
                        ff.mkdirp.sync(requestDir);
                    }
                    if (verbose) logger.info("Generating...", path.join(outputDir, filename))
                    ff.createFile(path.join(outputDir, subDir, filename), template.render(rootModel, config.partials), 'utf8');
                }
            }
            if (config.Functions) {
                let toplevel = clone(model);
                delete toplevel.apiInfo;
                Object.keys(config.Functions).map(function (language) {
                    templateFolder = path.join('functions', language);
                    for (let item of config.Functions[language]) {
                        let fnTemplate = Hogan.compile(item.output);
                        let template = Hogan.compile(ff.readFileSync(tpl(templateFolder, item.input), 'utf8'));
                        model.apiInfo.services.map(svc => {
                            let serviceModel = Object.assign({}, config.defaults, item.defaults || {}, toplevel, svc, config.apis);
                            if (serviceModel.serviceLang == language) {
                                let filename = fnTemplate.render(serviceModel, config.partials);
                                let requestDir = require('path').dirname(path.join(outputDir, subDir, filename))
                                if (!ff.existsSync(requestDir)) {
                                    ff.mkdirp.sync(requestDir);
                                }
                                if (verbose) logger.info("Generating...", path.join(outputDir, filename))
                                ff.createFile(path.join(outputDir, subDir, filename), template.render(serviceModel, config.partials), 'utf8');
                            }
                        })
                    }
                })
            }
            if (config.ServiceModel) {
                let toplevel = clone(model);
                delete toplevel.apiInfo;
                Object.keys(config.ServiceModel).map(function (language) {
                    templateFolder = path.join('functions', language);
                    for (let item of config.ServiceModel[language]) {
                        let fnTemplate = Hogan.compile(item.output);
                        let template = Hogan.compile(ff.readFileSync(tpl(templateFolder, item.input), 'utf8'));
                        model.apiInfo.services.map(svc => {
                            let models = {}
                            if (svc.serviceLang == language) {
                                svc.serviceEntries.map(endpoint => {
                                    if (!models[endpoint.serviceModelName]) {
                                        models[endpoint.serviceModelName] = endpoint
                                    } else {
                                        models[endpoint.serviceModelName] = {
                                            serviceModelName: endpoint.serviceModelName,
                                            serviceName: endpoint.serviceName,
                                            serviceNamePosix: endpoint.serviceNamePosix,
                                            serviceModelLegacy: endpoint.serviceModelLegacy,
                                            operations: [...models[endpoint.serviceModelName].operations, ...endpoint.operations]
                                        }
                                    }
                                })
                                Object.keys(models).forEach(key => {
                                    let serviceModel = Object.assign({}, config.defaults, item.defaults || {}, toplevel, models[key], config.apis);
                                    let filename = fnTemplate.render(serviceModel, config.partials);
                                    let requestDir = require('path').dirname(path.join(outputDir, subDir, filename))
                                    if (!ff.existsSync(requestDir)) {
                                        ff.mkdirp.sync(requestDir);
                                    }
                                    if (verbose) logger.info("Generating...", path.join(outputDir, filename))
                                    ff.createFile(path.join(outputDir, subDir, filename), template.render(serviceModel, config.partials), 'utf8');
                                })
                            }
                        })
                    }
                })
            }
            if (config.ServiceOperation) {
                let toplevel = clone(model);
                delete toplevel.apiInfo;
                Object.keys(config.ServiceOperation).map(function (language) {
                    templateFolder = path.join('functions', language);
                    for (let item of config.ServiceOperation[language]) {
                        let fnTemplate = Hogan.compile(item.output);
                        let template = Hogan.compile(ff.readFileSync(tpl(templateFolder, item.input), 'utf8'));
                        model.apiInfo.services.map(svc => {
                            if (svc.serviceLang == language) {
                                svc.serviceEntries.map(endpoint => {
                                    endpoint.operations.map(op => {
                                        let operation = Object.assign({}, config.defaults, item.defaults || {}, toplevel, endpoint, op, config.apis);
                                        let filename = fnTemplate.render(operation, config.partials);
                                        let requestDir = require('path').dirname(path.join(outputDir, subDir, filename))
                                        if (!ff.existsSync(requestDir)) {
                                            ff.mkdirp.sync(requestDir);
                                        }
                                        if (verbose) logger.info("Generating...", path.join(outputDir, filename))
                                        ff.createFile(path.join(outputDir, subDir, filename), template.render(operation, config.partials), 'utf8');
                                    })
                                })
                            }
                        })
                    }
                })
            }
            if (callback) callback(null, true);
        }
        for (let t in config.Application) {
            let tx = config.Application[t];
            if (tx.input) {
                if (verbose) logger.info('Processing template ' + tx.input);
                tx.template = ff.readFileSync(tpl(templateFolder, tx.input), 'utf8');
            }
            actions.push(tx);
        }
    });
}

module.exports = {
    fileFunctions: ff,
    main: main
};

