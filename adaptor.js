'use strict';
const yaml = require('yaml');
const uuidv4 = require('uuid/v4');
const safeJson = require('safe-json-stringify');
const Case = require('case');
const sampler = require('openapi-sampler');
const clone = require('reftools/lib/clone.js').circularClone;
const validator = require('oas-validator').validateSync;
const downconverter = require('./downconvert.js');

const schemaProperties = [
    'format',
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'minLength',
    'maxLength',
    'multipleOf',
    'minItems',
    'maxItems',
    'uniqueItems',
    'minProperties',
    'maxProperties',
    'additionalProperties',
    'pattern',
    'enum',
    'default'
];

let arrayMode = 'length';
let thisFunc = encodeURIComponent;

function safeSample(schema, options, api) {
    try {
        return sampler.sample(schema, options, api);
    }
    catch (ex) {
        console.warn('Sampler:', ex.message);
    }
    return {};
}

function convertStringArray(arr) {
    if (!arr) arr = [];
    if (arr.length) {
        arr.isEmpty = false;
        for (let i = 0; i < arr.length; i++) {
            if (typeof (arr[i]) == 'string') arr[i] = { value: arr[i] }
            arr[i]['first'] = (i === 0);
            arr[i]['last'] = (i === arr.length - 1);
            arr[i].hasMore = (i < arr.length - 1);
        }
    }
    else arr.isEmpty = true;
    arr.toString = function () { if (arrayMode === 'length') return this.length.toString() };
    return arr;
}

function convertArray(arr) {
    if (!arr) arr = [];
    if (arr.length) {
        arr.isEmpty = false;
        for (let i = 0; i < arr.length; i++) {
            arr[i]['-first'] = (i === 0);
            arr[i]['-last'] = (i === arr.length - 1);
            arr[i].hasMore = (i < arr.length - 1);
        }
    }
    else arr.isEmpty = true;
    arr.toString = function () { if (arrayMode === 'length') return this.length.toString() };
    return arr;
}


function specificationExtensions(obj) {
    let result = {};
    for (let k in obj) {
        if (k.startsWith('x-')) result[k] = obj[k];
    }
    return result;
}

function convertOperation(op, verb, path, pathItem, obj, api) {
    let operation = {};
    operation.httpMethod = verb.toUpperCase();
    operation.httpMethodLowerCase = verb.toLowerCase();
    operation.httpMethodHasBody = operation.httpMethodLowerCase == 'post' || operation.httpMethodLowerCase == 'put' || operation.httpMethodLowerCase == 'patch'
    if (obj.httpMethodLowerCase === 'original') operation.httpMethod = verb; // extension
    operation.path = path;
    operation.replacedPathName = path;
    Object.keys(op).forEach(key => {
        if (key.startsWith('x-api-service-model-')) {
            const convertedKey = key.replace('x-api-service-model-', '').toCamelCase().split(' ').join('').split('-').join('')
            operation[convertedKey] = typeof (op[key]) === 'object' ? convertStringArray(op[key]) : op[key];
        }
        if (key.startsWith('x-control-service-')) {
            const varName = key.replace('x-control-service-', '').toCamelCase().split(' ').join('').split('-').join('')
            operation[varName] = op[key]
        }
    })
    operation.operationId = op.operationId || ('operation' + obj.openapi.operationCounter++);
    operation.operationIdLowerCase = operation.operationId.toLowerCase();
    operation.operationIdSnakeCase = Case.snake(operation.operationId);
    operation.description = op.description;
    operation.summary = op.summary;
    operation.allParams = [];
    operation.pathParams = [];
    operation.queryParams = [];
    operation.headerParams = [];
    operation.formParams = [];
    operation.firstParamName = undefined;
    operation.summary = op.summary;
    operation.notes = op.description;
    if (!operation.notes) {
        operation.notes = { isEmpty: true };
        operation.notes.toString = function () { return '' };
    }
    operation.baseName = 'Default';
    if (op.tags && op.tags.length) {
        operation.baseName = op.tags[0];
    }
    operation.produces = [];
    operation.consumes = [];
    operation.hasParams = false;
    operation.hasOptionalParams = false;
    operation.hasRequiredParams = false;
    operation.hasQueryParams = false;
    operation.hasFormParams = false;
    operation.hasPathParams = false;
    operation.hasHeaderParams = false;
    operation.hasBodyParam = false;
    operation.openapi = {};

    let effParameters = (op.parameters || []).concat(pathItem.parameters || []);
    effParameters = effParameters.filter((param, index, self) => self.findIndex((p) => { return p.name === param.name && p.in === param.in; }) === index);

    const paramList = [];
    for (let pa in effParameters) {
        operation.hasParams = true;
        let param = effParameters[pa];
        let parameter = {};
        parameter.isHeaderParam = false;
        parameter.isQueryParam = false;
        parameter.isPathParam = false;
        parameter.isBodyParam = false;
        parameter.isFormParam = false;
        parameter.paramName = param.name;
        parameter.baseName = param.name;
        paramList.push(param.name);
        parameter.required = param.required || false;
        parameter.optional = !parameter.required;
        if (parameter.required) operation.hasRequiredParams = true;
        if (!parameter.required) operation.hasOptionalParams = true;
        parameter.dataType = typeMap(param.schema.type, parameter.required, param.schema);
        parameter["%dataType%"] = parameter.dataType; // bug in typescript-fetch template? trying to use {{{ with different delimiters
        for (let p of schemaProperties) {
            if (typeof param.schema[p] !== 'undefined') parameter[p] = param.schema[p];
        }
        parameter.example = JSON.stringify(safeSample(param.schema, {}, api));
        parameter.isBoolean = (param.schema.type === 'boolean');
        parameter.isInteger = (param.schema.type === 'integer');
        parameter.isNumber = (param.schema.type === 'number');
        parameter.isPrimitiveType = (!param.schema["x-oldref"]);
        parameter.dataFormat = param.schema.format;
        parameter.isDate = (parameter.dataFormat == 'date');
        parameter.isDateTime = (parameter.dataFormat == 'date-time');
        parameter.description = param.description || '';
        parameter.unescapedDescription = param.description;
        parameter.defaultValue = (param.schema && typeof param.schema.default !== 'undefined') ? param.schema.default : undefined;
        parameter.isFile = false;
        parameter.isEnum = false; // TODO?
        parameter.vendorExtensions = specificationExtensions(param);
        if (param.schema && param.schema.nullable) {
            parameter.vendorExtensions["x-nullable"] = true;
        }
        if (param.style === 'form') {
            if (param.explode) {
                parameter.collectionFormat = 'multi';
            }
            else {
                parameter.collectionFormat = 'csv';
            }
        }
        else if (param.style === 'simple') {
            parameter.collectionFormat = 'csv';
        }
        else if (param.style === 'spaceDelimited') {
            parameter.collectionFormat = 'ssv';
        }
        else if (param.style === 'pipeDelimited') {
            parameter.collectionFormat = 'pipes';
        }
        if ((param["x-collectionFormat"] === 'tsv') || (param["x-tabDelimited"])) {
            parameter.collectionFormat = 'tsv';
        }
        if (param.name == "x-api-token") {
            parameter.paramName = 'token';
        }
        if (!operation.firstParamName) {
            operation.firstParamName = parameter.paramName;
        }
        operation.allParams.push(parameter);
        if (param.in === 'path') {
            parameter.isPathParam = true;
            operation.pathParams.push(clone(parameter));
            operation.hasPathParams = true;
        }
        if (param.in === 'query') {
            parameter.isQueryParam = true;
            operation.queryParams.push(clone(parameter));
            operation.hasQueryParams = true;
        }
        if (param.in === 'header') {
            parameter.isHeaderParam = true;
            operation.headerParams.push(clone(parameter));
            operation.hasHeaderParams = true;
        }
    } // end of effective parameters    
    operation.operationId = op.operationId || Case.camel((op.tags ? op.tags[0] : '') + (paramList ? '_' + paramList.join('_') + '_' : '') + verb);
    operation.operationIdLowerCase = operation.operationId.toLowerCase();
    operation.operationIdSnakeCase = Case.snake(operation.operationId);
    operation.bodyParams = [];
    if (op.requestBody) {
        operation.openapi.requestBody = op.requestBody;
        operation.hasParams = true;
        operation.hasBodyParam = true;
        operation.bodyParam = {};
        operation.bodyParam.isBodyParam = true;
        operation.bodyParam.isHeaderParam = false;
        operation.bodyParam.isQueryParam = false;
        operation.bodyParam.isPathParam = false;
        operation.bodyParam.isFormParam = false;
        operation.bodyParam.isDate = false;
        operation.bodyParam.isDateTime = false;
        operation.bodyParam.baseName = 'body';
        operation.bodyParam.paramName = 'body';
        operation.bodyParam.baseType = 'object';
        operation.bodyParam.required = op.requestBody.required || false;
        operation.bodyParam.optional = !operation.bodyParam.required;
        if (operation.bodyParam.required) operation.hasRequiredParams = true;
        if (!operation.bodyParam.required) operation.hasOptionalParams = true;
        operation.bodyParam.dataType = typeMap('object', operation.bodyParam.required, {}); // can be changed below
        operation.bodyParam.description = op.requestBody.description || '';
        operation.bodyParam.schema = {};
        operation.bodyParam.isEnum = false; // TODO?
        operation.bodyParam.vendorExtensions = specificationExtensions(op.requestBody);
        if (op.requestBody.content) {
            let contentType = Object.values(op.requestBody.content)[0];
            let mt = { mediaType: Object.keys(op.requestBody.content)[0] };
            operation.consumes.push(mt);
            operation.hasConsumes = true;
            let tmp = obj.consumes.find(function (e, i, a) {
                return (e.mediaType === mt.mediaType);
            });
            if (!tmp) {
                obj.consumes.push(clone(mt)); // so convertArray works correctly
                obj.hasConsumes = true;
            }
            operation.bodyParam.schema = contentType.schema;
            operation.bodyParam.example = JSON.stringify(safeSample(contentType.schema, {}, api));
            for (let p in schemaProperties) {
                if (typeof contentType.schema[p] !== 'undefined') operation.bodyParam[p] = contentType.schema[p];
            }
            if (contentType.schema.type) {
                operation.bodyParam.type = contentType.schema.type;
                operation.bodyParam.dataType = typeMap(contentType.schema.type, operation.bodyParam.required, contentType.schema); // this is the below mentioned
            }
        }
        operation.bodyParam["%dataType%"] = operation.bodyParam.dataType; // bug in typescript-fetch template?
        operation.bodyParam.jsonSchema = safeJson({ schema: operation.bodyParam.schema }, null, 2);
        operation.bodyParams.push(operation.bodyParam);
        operation.bodyParam.isFile = false; // TODO
        operation.allParams.push(clone(operation.bodyParam));
    }
    operation.tags = op.tags;
    operation.imports = op.tags;
    operation.vendorExtensions = specificationExtensions(op);

    operation.responses = [];
    for (let r in op.responses) {
        if (!r.startsWith('x-')) {
            let response = op.responses[r];
            let entry = {};
            entry.code = r;
            entry.isDefault = (r === 'default');
            entry.operationName = 'response' + r;
            entry.message = response.description;
            entry.description = response.description || '';
            entry.simpleType = true;
            entry.schema = {};
            entry.jsonSchema = safeJson({ schema: entry.schema }, null, 2);
            if (response.content) {
                entry.baseType = 'object';
                entry.dataType = typeMap(entry.baseType, false, {});
                let contentType = Object.values(response.content)[0];
                let mt = {};
                mt.mediaType = Object.keys(response.content)[0];
                operation.produces.push(mt);
                operation.hasProduces = true;
                let tmp = obj.produces.find(function (e, i, a) {
                    return (e.mediaType === mt.mediaType);
                });
                if (!tmp) {
                    obj.produces.push(clone(mt)); // so convertArray works correctly
                    obj.hasProduces = true;
                }
                if (contentType && contentType.schema) {
                    entry.schema = contentType.schema;
                    entry.jsonSchema = safeJson({ schema: entry.schema }, null, 2);
                    entry.baseType = contentType.schema.type;
                    entry.isPrimitiveType = true;
                    entry.dataType = typeMap(contentType.schema.type, false, entry.schema);
                    if (contentType.schema["x-oldref"]) {
                        entry.dataType = contentType.schema["x-oldref"].replace('#/components/schemas/', '');
                        entry.isPrimitiveType = false;
                    }
                }
                if (contentType && contentType.example) {
                    entry.hasExamples = true;
                    if (!entry.examples) entry.examples = [];
                    entry.examples.push({ contentType: mt.mediaType, example: JSON.stringify(contentType.example, null, 2) });
                }
                if (contentType && contentType.examples) {
                    for (let ex in contentType.examples) {
                        const example = contentType.examples[ex];
                        if (example.value) {
                            entry.hasExamples = true;
                            if (!entry.examples) entry.examples = [];
                            entry.examples.push({ contentType: mt.mediaType, example: JSON.stringify(example.value, null, 2) });
                        }
                    }
                }

                if (!entry.hasExamples && entry.schema) {
                    let example = safeSample(entry.schema, {}, api);
                    if (example) {
                        entry.hasExamples = true;
                        if (!entry.examples) entry.examples = [];
                        entry.examples.push({ contentType: mt.mediaType, example: JSON.stringify(example, null, 2) });
                    }
                }

                operation.examples = (operation.examples || []).concat(entry.examples || []);

                operation.returnType = entry.dataType;
                operation.returnBaseType = entry.baseType;
                operation.returnTypeIsPrimitive = entry.isPrimitiveType;
                operation.returnContainer = ((entry.baseType === 'object') || (entry.baseType === 'array'));

            }
            entry.responseHeaders = []; // TODO responseHeaders
            entry.responseHeaders = convertArray(entry.responseHeaders);
            entry.examples = convertArray(entry.examples);
            entry.openapi = {};
            entry.openapi.links = response.links;
            operation.responses.push(entry);
            operation.responses = convertArray(operation.responses);
        }

        if (obj.sortParamsByRequiredFlag) {
            operation.allParams = operation.allParams.sort(function (a, b) {
                if (a.required && !b.required) return -1;
                if (b.required && !a.required) return +1;
                return 0;
            });
        }
    }
    operation.pathParams.map(p => {
        operation.replacedPathName = operation.path.replace(`{${p.paramName}}`, `:${p.paramName}`)
    })
    operation.queryParams = convertArray(operation.queryParams);
    operation.headerParams = convertArray(operation.headerParams);
    operation.pathParams = convertArray(operation.pathParams);
    operation.formParams = convertArray(operation.formParams);
    operation.bodyParams = convertArray(operation.bodyParams);
    operation.allParams = convertArray(operation.allParams);
    operation.examples = convertArray(operation.examples);
    operation.openapi.callbacks = op.callbacks;
    return operation;
}

function convertToServices(source, obj, defaults) {
    let services = []
    let paths = [];

    for (let p in source.paths) {
        for (let m in source.paths[p]) {
            if ((m !== 'parameters') && (m !== 'summary') && (m !== 'description') && (!m.startsWith('x-'))) {
                let op = source.paths[p][m];
                let tagName = 'Default';
                if (op.tags && op.tags.length > 0) {
                    tagName = op.tags[0];
                }
                let entry = paths.find(function (e, i, a) {
                    return (e.name === p);
                });
                const serviceName = source.paths[p]['x-api-service-name'] || source.paths[p]['x-event-service-name']
                var serviceMeta = {
                    serviceName: serviceName,
                    serviceType: 'aws::lambda'
                }
                Object.keys(source.paths[p]).map(function (key) {
                    if (key && (key.startsWith('x-api-service-') || key.startsWith('x-event-service-'))) {
                        const varName = key.replace('x-api-', '').replace('x-event-', '').toCamelCase().split(' ').join('').split('-').join('')
                        if (typeof (source.paths[p][key]) === 'string') {
                            const varData = source.paths[p][key].toCamelCase().split(' ').join('').split('-').join('')
                            serviceMeta[varName] = varData
                            serviceMeta[varName + 'Posix'] = Case.snake(varData).split('_').join('-');
                            serviceMeta[varName + 'Pascal'] = varData.toPascalCase()
                            serviceMeta[varName + 'Origin'] = source.paths[p][key]
                        } else {
                            serviceMeta[varName] = serviceMeta[varName + 'Posix'] = serviceMeta[varName + 'Pascal'] = source.paths[p][key]
                        }
                    }
                })
                if (!entry) {
                    entry = {};
                    entry.path = p;
                    const split = p.replace(/^\//, '').split(/\//g);
                    const defaultServiceName = split.map(v => v.replace(/{([^}]+)}/g, (v, v1) => `By${v1[0].toUpperCase()}${v1.slice(1)}`).replace(/^./, (v) => `${v[0].toUpperCase()}${v.slice(1)}`)).join('').toCamelCase().split(' ').join('').split('-').join('')
                    serviceMeta.serviceModelName = serviceMeta.serviceModelName || defaultServiceName;
                    if (serviceName) {
                        serviceMeta = {
                            ...serviceMeta,
                            serviceNamePascal: serviceName.toPascalCase(),
                            serviceNamePosix: Case.snake(serviceName).split('_').join('-')
                        }
                        entry = { ...entry, ...serviceMeta }
                        entry.serviceMeta = serviceMeta;
                        entry.operations = [];
                        paths.push(entry);
                    }
                }
                if (serviceName) {
                    let operation = convertOperation(op, m, p, source.paths[p], obj, source);
                    entry.operations.push(operation);
                }
            }
        }
    }
    for (let t in source.tags) {
        let tag = source.tags[t];
        let entry = paths.find(function (e, i, a) {
            return (e.name === t);
        });
        if (entry) {
            entry.tagName = tag.name + 'Tag';
            entry.description = tag.description;
            entry.externalDocs = tag.externalDocs;
        }
    }
    for (let path of paths) {
        let service = services.find(function (e, i, a) {
            return (e.serviceName === path.serviceName);
        });
        if (!service) {
            service = {
                ...path.serviceMeta,
                serviceHystrixStream: path.serviceHystrixStream,
                serviceEntries: [path]
            }
            service.serviceLang = service.serviceLang || 'javascript'
            if (service.serviceLang == 'javascript') {
                service.serviceLangExt = 'js'
                service.serviceRuntime = service.serviceRuntime || 'nodejs12.x'
                service.serviceCode = service.serviceCode || `exports.handler = function (event, context) { context.succeed({ "statusCode": 200, "body": JSON.stringify({}) })}`
            } else if (service.serviceLang == 'python') {
                service.serviceLangExt = 'py'
                service.serviceRuntime = service.serviceRuntime || 'python3.7'
                service.serviceCode = service.serviceCode || `def handler(event, context): return { \'statusCode\': 200, \'body'\: \'{}\' }`
            } else {
                service.serviceLangExt = 'py'
                service.serviceRuntime = service.serviceRuntime || 'python3.7'
                service.serviceCode = service.serviceCode || `def handler(event, context): return { \'statusCode\': 200, \'body'\: \'{}\' }`
            }
            service.serviceModels = [service.serviceModelName]
            services.push(service)
        } else {
            let serviceOperations = service.serviceEntries.find(function (e, i, a) {
                return (e.path === path.path);
            });
            if (!serviceOperations) {
                serviceOperations = path
                service.serviceEntries.push(serviceOperations)
            } else {
                serviceOperations.operations.push(path.operations[0])
            }
            service.serviceModels = service.serviceEntries.filter((v, i, a) => a.findIndex(t => (t.serviceModelName === v.serviceModelName)) === i)
            serviceOperations.hasOptions = serviceOperations.operations.some(op => op.httpMethodLowerCase == 'post' || op.httpMethodLowerCase == 'put' || op.httpMethodLowerCase == 'patch')
            service.serviceHystrixStream = service.serviceEntries.some(sp => sp.serviceHystrixStream == true)
        }
    }
    return convertArray(services);
}

const typeMaps = {
    nop: function (type, required, schema) {
        return type;
    },
    java: function (type, required, schema) {
        let result = type;
        if (!required) result += '?';
        return result;
    },
    javascript: function (type, required, schema) {
        let result = type;
        if (result === 'integer') result = 'number';
        return result;
    },
    typescript: function (type, required, schema) {
        let result = type;
        if (result === 'integer') result = 'number';
        if (result === 'array') {
            result = 'Array';
            if (schema.items && schema.items.type) {
                result += '<' + typeMap(schema.items.type, false, schema.items) + '>';
            }
        }
        return result;
    },
    go: function (type, required, schema) {
        let result = type;
        if (result === 'integer') result = 'int';
        if (result === 'boolean') result = 'bool';
        if (result === 'object') result = 'struct{}';
        if (result === 'array') {
            result = '[100]'; //!
            if (schema.items && schema.items.type) {
                result += typeMap(schema.items.type, false, schema.items);
            }
        }
        return result;
    }
};

const reservedWords = {
    nop: [],
    go: ['type']
};

let typeMap = typeMaps.nop;

function getBase() {
    let base = {};
    return base;
}

String.prototype.toCamelCase = function () {
    return this.replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
    }).replace(/\s+/g, '');
};

String.prototype.toPascalCase = function () {
    return this
        .replace(new RegExp(/[-_]+/, 'g'), ' ')
        .replace(new RegExp(/[^\w\s]/, 'g'), '')
        .replace(
            new RegExp(/\s+(.)(\w+)/, 'g'),
            ($1, $2, $3) => `${$2.toUpperCase() + $3.toLowerCase()}`
        )
        .replace(new RegExp(/\s/, 'g'), '')
        .replace(new RegExp(/\w/), s => s.toUpperCase());
};

function removeCustomPrefix(obj) {
    var tmp = {}
    try {
        if (Array.isArray(obj)) {
            tmp[k] = obj
        } else {
            Object.keys(obj).forEach(function (k) {
                if (k.startsWith('x-api') || k.startsWith('x-event') || k.startsWith('x-deployment') || k.startsWith('x-aws-global') || k.startsWith('x-control')) {
                } else if (typeof obj[k] === 'object') {
                    if (Array.isArray(obj[k])) {
                        tmp[k] = obj[k]
                    } else {
                        tmp[k] = removeCustomPrefix(obj[k])
                    }
                } else {
                    tmp[k] = obj[k]
                }
            })
        }
    } catch (err) {
        console.log(err.message)
    }
    return tmp
}

function getPrime(api, defaults) {
    let prime = {};
    prime.projectBundle = api.info.title;
    prime.apiName = api['x-api-gateway-name'].toCamelCase().split(' ').join('').split('-').join('');
    prime.deploymentName = api['x-deployment-name'];
    prime.deploymentNamePascal = prime.deploymentName.toPascalCase().split(' ').join('').split('-').join('');
    prime.deploymentRegion = api['x-deployment-region'];
    prime.deploymentProfile = api['x-deployment-profile'];
    prime.hystrixDashboard = api['x-api-hystrix-dashboard'] || false
    prime.apiNamePosix = Case.snake(prime.apiName).split('_').join('-');
    prime.deploymentNamePosix = Case.snake(prime.deploymentName).split('_').join('-');
    prime.projectName = api.info.title.toPascalCase().split(' ').join('').split('-').join('');
    prime.apiVersion = api.info.version;
    prime.appVersion = "0.1.1";
    prime.serviceVersion = "0.1.1";
    prime.projectVersion = "0.1.1";
    prime.version = api.info.version;
    prime.title = api.info.title;
    prime.generatorVersion = require('./package.json').version;
    prime.appDescription = api.info.description || 'No description';
    prime.projectDescription = prime.appDescription;
    prime.serviceDescription = prime.appDescription;
    prime.classVarName = 'default'; // see issue #21
    prime.appName = api.info.title;
    prime.host = ''
    prime.basePath = '/';
    prime.basePathWithoutHost = '/';
    prime.contextPath = '/';
    prime.generatedDate = new Date().toString();
    prime.generatorClass = defaults.configName; // 'class ' prefix?
    prime.templateDir = './templates/' + defaults.configName;
    prime.packageGuid = uuidv4(); /* The GUID that will be associated with the C# project */
    prime.httpUserAgent = 'AWS-Simplify/' + prime.packageVersion + '/' + defaults.configName; /* HTTP user agent, e.g. codegen_csharp_api_client, default to 'Swagger-Codegen/{packageVersion}}/{language}' */
    return prime;
}

function transform(api, defaults, callback) {
    let base = getBase(); // defaults which are hard-coded    
    let lang = (defaults.language || '').toLowerCase();
    if (typeMaps[lang]) typeMap = typeMaps[lang];
    if (reservedWords[lang]) reserved = reservedWords[lang];
    let message = {};
    let vOptions = { lint: defaults.lint };
    let prime = getPrime(api, defaults); // defaults which depend in some way on the api definition
    let obj = Object.assign({}, base, prime, defaults);
    obj.messages = [];
    const container = {};
    api.paths['/hystrix.stream'] = {
        get: {
            description: 'hystrix server-sent event stream',
            responses: {
                200: {
                    description: 'hystrix server-sent event response',
                    content: {
                        'text/event-stream': {
                            schema: {
                                type: 'object'
                            }
                        }
                    }
                }
            }
        }
    }
    container.spec = api;
    container.source = defaults.source;
    let conv = new downconverter(container);
    obj.swagger = conv.convert();
    delete obj.swagger.securityDefinitions
    obj["swagger-yaml"] = yaml.stringify(removeCustomPrefix(obj.swagger)); // set to original if converted v2.0
    obj["swagger-json"] = JSON.stringify(removeCustomPrefix(obj.swagger), null, 2); // set to original if converted 2.0
    obj["openapi-yaml"] = yaml.stringify(removeCustomPrefix(api));
    obj["openapi-json"] = JSON.stringify(removeCustomPrefix(api), null, 2);
    obj.openapi = {};
    obj.consumes = [];
    obj.produces = [];
    obj.openapi.operationCounter = 1;
    obj.openapi.version = api.openapi;
    obj.openapi.servers = api.servers;

    try {
        validator(api, vOptions, function (err) {
            if (!err) {
                message.level = 'Valid';
                message.elementType = 'Context';
                message.elementId = 'None';
                message.message = 'No validation errors detected';
                obj.messages.push(message);
                if (defaults.verbose) console.log(message);
                obj.this = function () {
                    console.warn('this called');
                    return thisFunc(this.paramName);
                };
                obj.apiInfo = {
                    apiName: api['x-api-gateway-name'].toCamelCase().split(' ').join('').split('-').join(''),
                    hystrixDashboard: api['x-api-hystrix-dashboard'] || false
                };
                obj.apiInfo.services = convertToServices(api, obj, defaults);
                obj.produces = convertArray(obj.produces);
                obj.consumes = convertArray(obj.consumes);
                if (callback) callback(null, obj);
            } else {
                console.log(`${err}`)
                if (callback) callback(err);
            }
        });

    }
    catch (ex) {
        message.level = 'Error';
        message.elementType = 'Context';
        message.elementId = vOptions.context.pop();
        message.message = ex.message;
        obj.messages.push(message);
        console.error(message);
        if (callback) callback(ex);
    }
}

module.exports = {
    transform: transform
};