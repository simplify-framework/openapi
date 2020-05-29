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
const CBEGIN = '\x1b[32m'
const CERROR = '\x1b[31m'
const CRESET = '\x1b[0m'
const CDONE = '\x1b[37m'

function creatFileOrPatch(filePath, newFileData, encoding, config) {
    try {
        if (fs.existsSync(filePath)) {            
            let ignoreOverridenFiles = [
                ".env.mustache",
                ".babelrc.mustache",
                ".gitignore.mustache",
                "package.mustache",
                "package-src.mustache",
                "function-input.mustache",
                "webpack.config.mustache",
                "webpack.config.layer.mustache",
                "docker-entrypoint.mustache",
                "Dockerfile.mustache",
                "README.mustache"
            ]            
            if (config.ignores) {
                config.ignores.split(';').forEach(function(ignore) {
                    const parts = ignore.split('.')
                    const ignoredFile = parts.splice(0, parts.length - 1).join('.') + '.mustache'
                    ignoreOverridenFiles.push(ignoredFile)
                })
            }
            if (ignoreOverridenFiles.indexOf(config.input)>=0) {
                if (config.verbose) logger.debug("F-Ignoring...", filePath)                
                return undefined
            } 
            var oldFile = fs.readFileSync(filePath).toString()
            function addNewLine(value, lastRemoved) {
                return lastRemoved ? `${value}>>>>>>> auto:${filePath}\n` : value
            }
            function removeYourLine(value, lastRemoved) {
                var newline = `<<<<<<< mine:${filePath}\n${value}=======\n`
                if (lastRemoved) newline += `>>>>>>> auto:${filePath}\n`
                return newline
            }
            if (config.merge) {
                var diff = jsdiff.diffLines(oldFile.toString(), newFileData, { newlineIsToken: false, ignoreWhitespace: false })
                var lastAdded = false
                var lastRemoved = false
                var index = 0
                var content = diff.map(function (part) {
                    if (++index == (diff.length -1) && part.removed) { lastRemoved = true }
                    var newcontent = part.removed ? removeYourLine(part.value, index == (diff.length -1)) : (part.added ? addNewLine(part.value, lastRemoved): part.value)
                    if (part.added) { lastAdded = true; lastRemoved = false;  }
                    if (part.removed) { lastAdded = false; lastRemoved = true; }
                    return newcontent
                }).join('');
                fs.writeFileSync(filePath, content, encoding);
                if (config.verbose) logger.info("M-Generating...", filePath)
                var patcheL = jsdiff.createPatch(`${filePath}`, oldFile.toString(), newFileData);
                if (jsdiff.parsePatch(patcheL)[0].hunks.length) {
                    console.log(` * ${CERROR}Require Review${CRESET} *: ${filePath}`)
                }
            } else {
                if (config.verbose) logger.info("R-Generating...", filePath)
                fs.writeFileSync(filePath, newFileData, encoding);
            }
            if (config.diff) {
                var patcheL = jsdiff.createPatch(`${filePath}`, oldFile.toString(), newFileData);
                if (jsdiff.parsePatch(patcheL)[0].hunks.length) {
                    fs.writeFileSync(`${filePath}.diff`, patcheL, encoding);
                }
            }
        } else {
            if (config.verbose) logger.info("N-Generating...", filePath)
            fs.writeFileSync(filePath, newFileData, encoding);
        }
    }
    catch (_) {
        if (config.verbose) logger.info("F-Generating...", filePath)
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
    return path.join(...segments)
}

function main(o, config, callback) {
    let outputDir = path.join(config.outputDir || './out/');
    let verbose = config.defaults.verbose;
    let cleanUp = config.cleanUp || false;
    let templateFolder = config.generator;
    adaptor.transform(o, config.defaults, function (err, model) {
        const subDir = (config.defaults.flat ? '' : 'output');
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
        function parseContent(type, model, config, locationDir) {
            if (config[type]) {
                let mermaidContent = { mermaidBase64JSON: '' }
                let toplevel = clone(model);
                delete toplevel.apiInfo;
                templateFolder = path.join(config.generator, locationDir);
                for (let cfg of config[type]) {
                    let fnTemplate = Hogan.compile(cfg.output);
                    let template = Hogan.compile(ff.readFileSync(tpl(templateFolder, cfg.input), 'utf8'));
                    let rootModel = Object.assign({}, config.defaults, cfg.defaults || {}, toplevel, model.apiInfo, config.apis);
                    rootModel.mermaidBase64JSON = mermaidContent.mermaidBase64JSON
                    let filename = fnTemplate.render(rootModel, config.partials);
                    let requestDir = require('path').dirname(path.join(outputDir, subDir, filename))
                    const content = template.render(rootModel, config.partials)
                    let textContent = JSON.stringify({"code": content,"mermaid":{"theme":"default"},"updateEditor":false})
                    const filePath = path.join(outputDir, subDir, filename)
                    if (cfg.input == "mermaid.mustache") {
                        mermaidContent.mermaidBase64JSON = new Buffer.alloc(textContent.length, textContent).toString('base64')
                    }
                    if (!ff.existsSync(requestDir)) {
                        ff.mkdirp.sync(requestDir);
                    }
                    creatFileOrPatch(filePath, content, 'utf8', { ...config.defaults, input: cfg.input } );
                }
            }
        }
        function generate() {
            parseContent('Deployments', model, config, "deployments")
            parseContent('Applications', model, config, "restapi")
            if (config.Functions) {
                let toplevel = clone(model);
                delete toplevel.apiInfo;
                Object.keys(config.Functions).map(function (pkg) {
                    templateFolder = path.join(config.generator, 'functions', pkg);
                    for (let cfg of config.Functions[pkg]) {
                        let fnTemplate = Hogan.compile(cfg.output);
                        let template = Hogan.compile(ff.readFileSync(tpl(templateFolder, cfg.input), 'utf8'));
                        model.apiInfo.services.map(svc => {
                            let serviceModel = Object.assign({}, config.defaults, cfg.defaults || {}, toplevel, svc, config.apis);
                            serviceModel.serviceControl = svc.serviceEntries.some(op => op.serviceControl)
                            if (`${svc.serviceTemplate}-${svc.serviceLanguage}` == pkg) {
                                let filename = fnTemplate.render(serviceModel, config.partials);
                                let requestDir = require('path').dirname(path.join(outputDir, subDir, filename))
                                if (!ff.existsSync(requestDir)) {
                                    ff.mkdirp.sync(requestDir);
                                }
                                creatFileOrPatch(path.join(outputDir, subDir, filename), template.render(serviceModel, config.partials), 'utf8', { ...config.defaults, input: cfg.input });
                            }
                        })
                    }
                })
            }
            if (config.ServiceModel) {
                let toplevel = clone(model);
                delete toplevel.apiInfo;
                Object.keys(config.ServiceModel).map(function (pkg) {
                    templateFolder = path.join(config.generator, 'functions', pkg);
                    for (let cfg of config.ServiceModel[pkg]) {
                        let fnTemplate = Hogan.compile(cfg.output);
                        let template = Hogan.compile(ff.readFileSync(tpl(templateFolder, cfg.input), 'utf8'));
                        model.apiInfo.services.map(svc => {
                            let models = {}
                            if (`${svc.serviceTemplate}-${svc.serviceLanguage}` == pkg) {
                                svc.serviceEntries.map(endpoint => {
                                    if (!models[endpoint.serviceModelName]) {
                                        models[endpoint.serviceModelName] = endpoint
                                    } else {
                                        models[endpoint.serviceModelName] = {
                                            serviceModelName: endpoint.serviceModelName,
                                            serviceName: endpoint.serviceName,
                                            serviceNameSnake: endpoint.serviceNameSnake,
                                            operations: [...models[endpoint.serviceModelName].operations, ...endpoint.operations]
                                        }
                                    }
                                })
                                Object.keys(models).forEach(key => {
                                    let serviceModel = Object.assign({}, config.defaults, cfg.defaults || {}, toplevel, models[key], config.apis);
                                    let filename = fnTemplate.render(serviceModel, config.partials);
                                    let requestDir = require('path').dirname(path.join(outputDir, subDir, filename))
                                    if (!ff.existsSync(requestDir)) {
                                        ff.mkdirp.sync(requestDir);
                                    }
                                    creatFileOrPatch(path.join(outputDir, subDir, filename), template.render(serviceModel, config.partials), 'utf8', { ...config.defaults, input: cfg.input });
                                })
                            }
                        })
                    }
                })
            }
            if (config.ServiceOperation) {
                let toplevel = clone(model);
                delete toplevel.apiInfo;
                Object.keys(config.ServiceOperation).map(function (pkg) {
                    templateFolder = path.join(config.generator, 'functions', pkg);
                    for (let cfg of config.ServiceOperation[pkg]) {
                        let fnTemplate = Hogan.compile(cfg.output);
                        let template = Hogan.compile(ff.readFileSync(tpl(templateFolder, cfg.input), 'utf8'));
                        model.apiInfo.services.map(svc => {
                            if (`${svc.serviceTemplate}-${svc.serviceLanguage}` == pkg) {
                                svc.serviceEntries.map(endpoint => {
                                    endpoint.operations.map(op => {
                                        let operation = Object.assign({}, config.defaults, cfg.defaults || {}, toplevel, endpoint, op, config.apis);
                                        let filename = fnTemplate.render(operation, config.partials);
                                        let requestDir = require('path').dirname(path.join(outputDir, subDir, filename))
                                        if (!ff.existsSync(requestDir)) {
                                            ff.mkdirp.sync(requestDir);
                                        }
                                        creatFileOrPatch(path.join(outputDir, subDir, filename), template.render(operation, config.partials), 'utf8', { ...config.defaults, input: cfg.input });
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

