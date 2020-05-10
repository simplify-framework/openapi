// @ts-nocheck

'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const jsdiff = require('diff');
const mkdirp = require('mkdirp');
const rimraf = require('rimraf');
const Hogan = require('hogan.js');
const clone = require('reftools/lib/clone.js').circularClone;
const adaptor = require('./adaptor.js');

function creatFileOrPatch(filePath, newFileData, encoding, config) {
    try {
        if (fs.existsSync(filePath)) {
            var oldFile = fs.readFileSync(filePath).toString()
            if (config.merge) {
                var diff = jsdiff.diffChars(newFileData, oldFile.toString())
                var content = diff.map(function (part) {
                    return part.value
                }).join('');
                fs.writeFileSync(filePath, content, encoding);
            } else {
                fs.writeFileSync(filePath, newFileData, encoding);
            }
            if (config.diff) {
                var patches = jsdiff.createPatch(`${filePath}`, oldFile.toString(), newFileData);
                fs.writeFileSync(`${filePath}.diff`, patches, encoding);
            }
        } else {
            fs.writeFileSync(filePath, newFileData, encoding);
        }
    }
    catch (_) {
        fs.writeFileSync(filePath, newFileData, encoding);
    }
}

let ff = {
    readFileSync: fs.readFileSync,
    createFile: fs.writeFileSync,
    existsSync: fs.existsSync,
    rimraf: rimraf,
    mkdirp: mkdirp
};

function tpl(...segments) {
    return path.join(__dirname, 'packages', ...segments)
}

function main(o, config, callback) {
    let outputDir = path.join(config.outputDir || './out/');
    let verbose = config.defaults.verbose;
    let cleanUp = config.cleanUp || false;
    let templateFolder = '';
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
        function parseContent(type, model, config) {
            if (config[type]) {
                let toplevel = clone(model);
                delete toplevel.apiInfo;
                templateFolder = type.toLowerCase();
                for (let cfg of config[type]) {
                    let fnTemplate = Hogan.compile(cfg.output);
                    let template = Hogan.compile(ff.readFileSync(tpl(templateFolder, cfg.input), 'utf8'));
                    let rootModel = Object.assign({}, config.defaults, cfg.defaults || {}, toplevel, model.apiInfo, config.apis);
                    let filename = fnTemplate.render(rootModel, config.partials);
                    let requestDir = require('path').dirname(path.join(outputDir, subDir, filename))
                    if (!ff.existsSync(requestDir)) {
                        ff.mkdirp.sync(requestDir);
                    }
                    if (verbose) logger.info("Generating...", path.join(outputDir, filename))
                    ff.createFile(path.join(outputDir, subDir, filename), template.render(rootModel, config.partials), 'utf8');
                }
            }
        }
        function generate() {
            parseContent('Deployments', model, config)
            parseContent('Applications', model, config)
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
                            serviceModel.serviceControl = svc.serviceEntries.some(op => op.serviceControl)
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
                                    creatFileOrPatch(path.join(outputDir, subDir, filename), template.render(serviceModel, config.partials), 'utf8', config.defaults);
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
    });
}

module.exports = {
    fileFunctions: ff,
    main: main
};

