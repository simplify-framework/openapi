'use strict';
const yaml = require('yaml');
const uuidv4 = require('uuid/v4');
const safeJson = require('safe-json-stringify');
const Case = require('case');
const sampler = require('openapi-sampler');
const clone = require('reftools/lib/clone.js').circularClone;
const validator = require('oas-validator').validateSync;
const downconverter = require('./downconvert.js');
const logger = require('./logger');
const crypto = require('crypto')

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

function getProperties(obj, define, prefix) {
    var properties = {}
    Object.keys(obj).map(function (key) {
        if (key && key.startsWith(define)) {
            let varName = key.replace(define, '').toCamelCase().split(' ').join('').split('-').join('')
            varName = prefix ? prefix + varName.toPascalCase() : varName
            properties[varName + 'Existed'] = true
            if (key.startsWith('x-event-service-name')) {
                properties['eventServiceType'] = properties['eventServiceTypeBoolean'] = true 
            }
            if (typeof (obj[key]) === 'string') {
                const varData = (obj[key] || '').toCamelCase().split(' ').join('').split('-').join('')
                properties[varName] = varData
                properties[varName + 'Title'] = (obj[key] || '').split('-').join(' ')
                properties[varName + 'Snake'] = Case.snake(varData).split('_').join('-');
                properties[varName + 'Pascal'] = varData.toPascalCase()
                properties[varName + 'Origin'] = obj[key]
                properties[varName + obj[key].toPascalCase()] = true
            } else if (typeof (obj[key]) === 'number') {
                properties[varName] = properties[varName + 'Number'] = (obj[key] || 0)
            } else if (typeof (obj[key]) === 'boolean') {
                properties[varName] = properties[varName + 'Boolean'] = (obj[key] || false)
            } else if (typeof (obj[key]) === 'object') {
                if (Array.isArray(obj[key])) {
                    properties[varName] = properties[varName + 'Array']  = convertArray(obj[key] || [])
                } else {
                    properties[varName] = properties[varName + 'Object'] = (obj[key] || {})
                } 
            } else {
                properties[varName] = (obj[key] || undefined)
            }
        }
    })
    return properties
}

function convertArray(arr) {
    if (!arr) arr = [];
    if (arr.length) {
        arr.isEmpty = false;
        for (let i = 0; i < arr.length; i++) {
            if (typeof (arr[i]) === 'string') arr[i] = { value: arr[i] }
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

function convertMethodOperation(op, verb, path, pathItem, obj, api) {
    let operation = { ...getProperties(op, 'x-api-'), ...getProperties(op, 'x-control-') };
    operation.httpMethod = verb.toUpperCase();
    operation.httpMethodLowerCase = verb.toLowerCase();
    operation.httpMethodHasBody = operation.httpMethodLowerCase == 'post' || operation.httpMethodLowerCase == 'put' || operation.httpMethodLowerCase == 'patch'
    if (obj.httpMethodLowerCase === 'original') operation.httpMethod = verb; // extension
    operation.path = path;
    operation.replacedPathName = path;
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
    operation.operationId = op.operationId || Case.camel(operation.httpMethodLowerCase + (operation.path.split('/').join(' ').toPascalCase().split('/').join('')));
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
            let pathEntry = {};
            pathEntry.code = r;
            pathEntry.isDefault = (r === 'default');
            pathEntry.operationName = 'response' + r;
            pathEntry.message = response.description;
            pathEntry.description = response.description || '';
            pathEntry.simpleType = true;
            pathEntry.schema = {};
            pathEntry.jsonSchema = safeJson({ schema: pathEntry.schema }, null, 2);
            if (response.content) {
                pathEntry.baseType = 'object';
                pathEntry.dataType = typeMap(pathEntry.baseType, false, {});
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
                    pathEntry.schema = contentType.schema;
                    pathEntry.jsonSchema = safeJson({ schema: pathEntry.schema }, null, 2);
                    pathEntry.baseType = contentType.schema.type;
                    pathEntry.isPrimitiveType = true;
                    pathEntry.dataType = typeMap(contentType.schema.type, false, pathEntry.schema);
                    if (contentType.schema["x-oldref"]) {
                        pathEntry.dataType = contentType.schema["x-oldref"].replace('#/components/schemas/', '');
                        pathEntry.isPrimitiveType = false;
                    }
                }
                if (contentType && contentType.example) {
                    pathEntry.hasExamples = true;
                    if (!pathEntry.examples) pathEntry.examples = [];
                    pathEntry.examples.push({ contentType: mt.mediaType, example: JSON.stringify(contentType.example, null, 2) });
                }
                if (contentType && contentType.examples) {
                    for (let ex in contentType.examples) {
                        const example = contentType.examples[ex];
                        if (example.value) {
                            pathEntry.hasExamples = true;
                            if (!pathEntry.examples) pathEntry.examples = [];
                            pathEntry.examples.push({ contentType: mt.mediaType, example: JSON.stringify(example.value, null, 2) });
                        }
                    }
                }

                if (!pathEntry.hasExamples && pathEntry.schema) {
                    let example = safeSample(pathEntry.schema, {}, api);
                    if (example) {
                        pathEntry.hasExamples = true;
                        if (!pathEntry.examples) pathEntry.examples = [];
                        pathEntry.examples.push({ contentType: mt.mediaType, example: JSON.stringify(example, null, 2) });
                    }
                }

                operation.examples = (operation.examples || []).concat(pathEntry.examples || []);

                operation.returnType = pathEntry.dataType;
                operation.returnBaseType = pathEntry.baseType;
                operation.returnTypeIsPrimitive = pathEntry.isPrimitiveType;
                operation.returnContainer = ((pathEntry.baseType === 'object') || (pathEntry.baseType === 'array'));

            }
            pathEntry.responseHeaders = []; // TODO responseHeaders
            pathEntry.responseHeaders = convertArray(pathEntry.responseHeaders);
            pathEntry.examples = convertArray(pathEntry.examples);
            pathEntry.openapi = {};
            pathEntry.openapi.links = response.links;
            operation.responses.push(pathEntry);
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
    let serviceMetas = {};
    for (let p in source.paths) {
        var serviceMeta = {
            serviceType: 'aws::lambda',
            hasServicePath: true,
            ...getProperties(source.paths[p], 'x-api-'),
            ...getProperties(source.paths[p], 'x-event-')
        }
        serviceMetas[p] = serviceMeta
        for (let m in source.paths[p]) {
            if ((m !== 'parameters') && (m !== 'summary') && (m !== 'description') && (!m.startsWith('x-'))) {
                let op = source.paths[p][m];
                let tagName = 'Default';
                if (op.tags && op.tags.length > 0) {
                    tagName = op.tags[0];
                }
                let pathEntry = paths.find(function (e, i, a) {
                    return (e.name === p);
                });
                if (!pathEntry) {
                    pathEntry = {};
                    pathEntry.path = p;
                    const split = p.replace(/^\//, '').split(/\//g);
                    const defaultServiceName = split.map(v => v.replace(/{([^}]+)}/g, (v, v1) => `By${v1[0].toUpperCase()}${v1.slice(1)}`).replace(/^./, (v) => `${v[0].toUpperCase()}${v.slice(1)}`)).join('').toCamelCase().split(' ').join('').split('-').join('')
                    serviceMetas[p].serviceModelName = serviceMetas[p].serviceModelName || defaultServiceName;
                    if (serviceMeta.serviceName) {
                        pathEntry = { ...pathEntry, ...serviceMetas[p] }
                        pathEntry.serviceMeta = serviceMetas[p];
                        pathEntry.operations = [];
                        paths.push(pathEntry);
                    }
                }
                if (serviceMeta.serviceName) {
                    let operation = convertMethodOperation(op, m, p, source.paths[p], obj, source);
                    pathEntry.operations.push({...operation, ...serviceMetas[p]});
                }
            }
        }
    }
    for (let t in source.tags) {
        let tag = source.tags[t];
        let pathEntry = paths.find(function (e, i, a) {
            return (e.name === t);
        });
        if (pathEntry) {
            pathEntry.tagName = tag.name + 'Tag';
            pathEntry.description = tag.description;
            pathEntry.externalDocs = tag.externalDocs;
        }
    }
    for (let pathEntry of paths) {
        let service = services.find(function (e, i, a) {
            return (e.serviceName === pathEntry.serviceName);
        });
        if (!service) {
            service = {
                ...serviceMetas[pathEntry.path],
                serviceHystrixStream: pathEntry.serviceHystrixStream,
                serviceEntries: [pathEntry]
            }
            service.serviceTemplate = service.serviceTemplate || (service.eventServiceTypeBoolean ? 'flatted' : 'stacked')
            if (service.serviceTemplate == 'stacked' || service.serviceTemplate == 'flatted') {
                service.serviceRuntime = service.serviceRuntime || 'nodejs12.x'
                service.serviceRuntimeOrigin = service.serviceRuntimeOrigin || 'nodejs12.x'
                service.serviceCode = service.serviceCode || `exports.handler = function (event, context) { context.succeed({ statusCode: 200, body: JSON.stringify({}) })}`
            } else if (service.serviceTemplate == 'python') {
                service.serviceRuntime = service.serviceRuntime || 'python3.7'
                service.serviceRuntimeOrigin = service.serviceRuntimeOrigin || 'python3.7'
                service.serviceCode = service.serviceCode || `def handler(event, context): return { \"statusCode\": 200, \"body\": \"{}\" }`
            } else {
                service.serviceRuntime = service.serviceRuntime || 'python3.7'
                service.serviceRuntimeOrigin = service.serviceRuntimeOrigin || 'python3.7'
                service.serviceCode = service.serviceCode || `def handler(event, context): return { \'statusCode\': 200, \'body'\: \'{}\' }`
            }
            service.serviceModels = [service.serviceModelName]
            services.push(service)
        } else {
            let serviceOperations = service.serviceEntries.find(function (e, i, a) {
                return (e.path === pathEntry.path);
            });
            if (!serviceOperations) {
                serviceOperations = pathEntry
                service.serviceEntries.push(serviceOperations)
            } else {
                serviceOperations.operations.push({...pathEntry.operations[0], ...pathEntry.serviceMeta})
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
        logger.error(err.message)
    }
    return tmp
}

function cryptoRandomApiKey(size) {
    return crypto.randomBytes(size).toString('hex').slice(0, size)
}

function cryptoRandomNumber(minimum, maximum){
	var distance = maximum-minimum;
	if(minimum>=maximum){
		console.log('Minimum number should be less than maximum');
		return false;
	} else if(distance>281474976710655){
		console.log('You can not get all possible random numbers if range is greater than 256^6-1');
		return false;
	} else if(maximum>Number.MAX_SAFE_INTEGER){
		console.log('Maximum number should be safe integer limit');
		return false;
	} else {
		var maxBytes = 3;
		var maxDec = 16777216;
		var randbytes = parseInt(crypto.randomBytes(maxBytes).toString('hex'), 16);
		var result = Math.floor(randbytes/maxDec*(maximum-minimum+1)+minimum);
		if(result>maximum){
			result = maximum;
		}
		return result;
	}
}

function getPrime(api, defaults) {
    let require_fields = ['x-deployment-name', 'x-deployment-region', 'x-project-name']
    require_fields.forEach(function (f) {
        if (typeof api[f] === 'undefined') {
            logger.warn(`Missing required definition at root level: ${f}`)
            process.exit(-1)
        }
    })
    let prime = { ...getProperties(api, 'x-api-'), ...getProperties(api, 'x-deployment-', 'deployment') };
    prime.quotaUnitOrigin = prime.quotaUnitOrigin || 'DAY'
    prime.burstLimit = prime.burstLimit || 100
    prime.rateLimit = prime.rateLimit || 100
    prime.quotaLimit = prime.quotaLimit || 100
    prime.projectName = api['x-project-name'].toCamelCase().split(' ').join('').split('-').join('');
    prime.projectNamePascal = prime.projectName.toPascalCase().split(' ').join('').split('-').join('');
    prime.projectNameSnake = Case.snake(prime.projectName).split('_').join('-');
    prime.appDescription = api.info.description || api.info.title || 'Missing description in info.title or info.description';
    prime.projectDescription = prime.appDescription;
    prime.serviceDescription = prime.appDescription;
    prime.apiVersion = api.info.version;
    prime.appVersion = "0.1.1";
    prime.serviceVersion = "0.1.1";
    prime.projectVersion = "0.1.1";
    prime.projectId = api['x-project-id'] || cryptoRandomNumber(10000000, 99999999)
    api['x-project-id'] = prime.projectId
    prime.gatewayApiKey = api['x-api-key'] || cryptoRandomApiKey(40)
    api['x-api-key'] = prime.gatewayApiKey
    prime.version = api.info.version;
    prime.title = api.info.title;
    prime.generatorVersion = require('./package.json').version;
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
    obj["openapi-root"] = yaml.stringify(api);
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
                if (defaults.verbose) logger.info(message.message);
                obj.this = function () {
                    console.warn('this called');
                    return thisFunc(this.paramName);
                };
                obj.apiInfo = {
                    gatewayName: api['x-api-gateway-name'].toCamelCase().replace(/-/g,''),
                    controlDashboard: api['x-api-control-dashboard'] || false,
                    services: convertToServices(api, obj, defaults)
                }
                obj.produces = convertArray(obj.produces);
                obj.consumes = convertArray(obj.consumes);
                if (callback) callback(null, obj);
            } else {
                logger.error(`${err}`)
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