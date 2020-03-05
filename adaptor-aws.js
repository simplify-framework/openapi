'use strict';
const yaml = require('yaml');
const uuidv4 = require('uuid/v4');
const safeJson = require('safe-json-stringify');
const Case = require('case');
const sampler = require('openapi-sampler');
const clone = require('reftools/lib/clone.js').circularClone;
const validator = require('oas-validator').validateSync;
const downconverter = require('./lib/orange/downconvert.js');

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

function getAuthData(secSchemes, api) {
    let result = {};
    result.hasAuthMethods = (secSchemes && secSchemes.length > 0);
    result.authMethods = [];
    if (result.hasAuthMethods) {
        for (let ss of secSchemes) {
            for (let s in ss) {
                let scheme = api.components.securitySchemes[s];
                let entry = {};
                entry.name = s;
                entry.isApiKey = false;
                entry.isBasic = false;
                entry.isOAuth = false;
                if (scheme.type === 'http') {
                    entry.isBasic = true;
                }
                else if (scheme.type === 'oauth2') {
                    entry.isOAuth = true;
                    if (scheme.flows) {
                        entry.flow = Object.keys(scheme.flows)[0];
                        let flow = Object.values(scheme.flows)[0];
                        entry.authorizationUrl = flow.authorizationUrl;
                        entry.tokenUrl = flow.tokenUrl;
                        entry.scopes = [];
                        if (flow.scopes) {
                            for (let scope in flow.scopes) {
                                let sc = {};
                                sc.scope = scope;
                                entry.scopes.push(sc);
                            }
                        }
                        // override scopes with local subset
                        if (Array.isArray(ss[s])) {
                            let newScopes = [];
                            for (let scope of entry.scopes) {
                                if (ss[s].indexOf(scope.scope) >= 0) {
                                    newScopes.push(scope);
                                }
                            }
                            entry.scopes = newScopes;
                        }
                        entry.scopes = convertArray(entry.scopes);
                    }
                }
                else if (scheme.type == 'apiKey') {
                    entry.isApiKey = true;
                    entry.keyParamName = scheme.name;
                    entry.isKeyInQuery = (scheme.in === 'query');
                    entry.isKeyInHeader = (scheme.in === 'header');
                    entry.isKeyInCookie = (scheme.in === 'cookie'); // extension
                }
                else {
                    entry.openapi = {};
                    entry.openapi.scheme = scheme;
                }
                result.authMethods.push(entry);
            }
        }
        result.authMethods = convertArray(result.authMethods);
    }
    return result;
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
    operation.httpMethodCase = verb.toLowerCase();
    operation.httpMethodHasBody = operation.httpMethodCase == 'post' || operation.httpMethodCase == 'put' || operation.httpMethodCase == 'patch'
    if (obj.httpMethodCase === 'original') operation.httpMethod = verb; // extension
    operation.path = path;
    operation.replacedPathName = path; //?    
    operation.circuitProtection = op['x-micro-service-circuit-protection'] || false;
    operation.operationTimeout = op['x-micro-service-circuit-timeout'] || 60000;
    operation.circuitDuration = op['x-micro-service-circuit-duration'] || 30000;
    operation.circuitThreshold = op['x-micro-service-circuit-threshold'] || 0.1;
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
    //operation.hasMore = true; // last one gets reset to false
    operation.isResponseBinary = false; //TODO
    operation.isResponseFile = false; //TODO
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

    let authData = getAuthData(op.security || api.security, api);
    operation = Object.assign(operation, authData);

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
        /* if (param.in === 'form') { // TODO need to do this in requestBody
            parameter.isFormParam = true;
            operation.formParams.push(clone(parameter));
            operation.hasFormParams = true;
        }*/
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
                if (!entry) {
                    const split = p.replace(/^\//, '').split(/\//g);
                    const className = source.paths[p]['x-micro-service-model-name'] || split.map(v => v.replace(/{([^}]+)}/g, (v, v1) => `By${v1[0].toUpperCase()}${v1.slice(1)}`).replace(/^./, (v) => `${v[0].toUpperCase()}${v.slice(1)}`)).join('');
                    entry = {};
                    entry.path = p;
                    if (source.paths[p]['x-micro-service-name']) {
                        entry.serviceName = source.paths[p]['x-micro-service-name'].toCamelCase().split(' ').join('').split('-').join('');
                        entry.serviceNamePosix = Case.snake(entry.serviceName).split('_').join('-');
                        entry.className = className.toPascalCase().split(' ').join('').split('-').join('');
                        entry.operations = [];
                        paths.push(entry);
                    }
                }
                if (source.paths[p]['x-micro-service-name']) {
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
                serviceName: path.serviceName,
                serviceNamePosix: path.serviceNamePosix,
                servicePoints: [path]
            }
            services.push(service)
        } else {
            let serviceOperations = service.servicePoints.find(function (e, i, a) {
                return (e.path === path.path);
            });
            if (!serviceOperations) {
                serviceOperations = path
                service.servicePoints.push(serviceOperations)
            } else {
                serviceOperations.operations.push(path.operations[0])
            }
            serviceOperations.hasOptions = serviceOperations.operations.some(op => op.httpMethodCase == 'post' || op.httpMethodCase == 'put' || op.httpMethodCase == 'patch')
        }
    }
    return services;
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

function getPrime(api, defaults) {
    let prime = {};
    prime.projectBundle = api.info.title;
    prime.apiName = api['x-api-gateway-name'].toCamelCase().split(' ').join('').split('-').join('');
    prime.apiNamePosix = Case.snake(prime.apiName).split('_').join('-');
    prime.projectName = api.info.title.toPascalCase().split(' ').join('').split('-').join('');
    prime.appVersion = api.info.version;
    prime.apiVersion = api.info.version;
    prime.packageVersion = api.info.version;
    prime.projectVersion = api.info.version;
    prime.version = api.info.version;
    prime.title = api.info.title;
    prime.generatorVersion = require('./package.json').version;
    prime.appDescription = api.info.description || 'No description';
    prime.projectDescription = prime.appDescription;
    prime.classVarName = 'default'; // see issue #21
    prime.appName = api.info.title;
    prime.host = ''
    prime.basePath = '/';
    prime.basePathWithoutHost = '/';
    prime.contextPath = '/';
    prime.generatedDate = new Date().toString();
    prime.generatorClass = defaults.configName; // 'class ' prefix?
    prime.sourceFolder = './out/' + defaults.configName; /* source folder for generated code */
    prime.templateDir = './templates/' + defaults.configName;
    prime.implementation = prime.sourceFolder; /* folder for generated implementation code */
    prime.packageGuid = uuidv4(); /* The GUID that will be associated with the C# project */
    prime.httpUserAgent = 'OpenAPI-Codegen/' + prime.packageVersion + '/' + defaults.configName; /* HTTP user agent, e.g. codegen_csharp_api_client, default to 'Swagger-Codegen/{packageVersion}}/{language}' */
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
    obj["swagger-yaml"] = yaml.stringify(obj.swagger); // set to original if converted v2.0
    obj["swagger-json"] = JSON.stringify(obj.swagger, null, 2); // set to original if converted 2.0
    obj["openapi-yaml"] = yaml.stringify(api);
    obj["openapi-json"] = JSON.stringify(api, null, 2);
    obj.openapi = {};
    obj.consumes = [];
    obj.produces = [];
    obj.openapi.operationCounter = 1;
    obj.openapi.version = api.openapi;
    obj.openapi.servers = api.servers;

    try {
        validator(api, vOptions);
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
            apiName: api['x-api-gateway-name'].toCamelCase().split(' ').join('').split('-').join('')
        };
        obj.apiInfo.services = convertToServices(api, obj, defaults);
        obj.produces = convertArray(obj.produces);
        obj.consumes = convertArray(obj.consumes);
    }
    catch (ex) {
        message.level = 'Error';
        message.elementType = 'Context';
        message.elementId = vOptions.context.pop();
        message.message = ex.message;
        obj.messages.push(message);
        console.error(message);
    }
    if (callback) callback(null, obj);
    return obj;
}

module.exports = {
    transform: transform
};