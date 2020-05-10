global.fetch = require('node-fetch')
require("@babel/polyfill")
const AWS = require('aws-sdk')
const sigV4Client = require('./sigV4Client')
const AmazonCognitoIdentity = require('amazon-cognito-identity-js');
let apiConfig = {}

export const config = function(config) {
    return new Promise(function(resolve, _) {
        apiConfig = { ...config }
        if (config.UserPoolsID && config.UserPoolsClientID) {
            apiConfig.UserPool = new AmazonCognitoIdentity.CognitoUserPool({
                UserPoolId: config.UserPoolsID,
                ClientId: config.UserPoolsClientID
            });
        }
        apiConfig.get = function(name) {
            var result = null
            apiConfig.Outputs.some(function(output) {
                if (output.OutputKey === name) {
                    result = output.OutputValue
                    return true
                }
                return false
            })
            return result
        }
        resolve(apiConfig)
    })
}

function getAwsCredentials() {
    AWS.config.update({ region: apiConfig.Region });
    if (apiConfig.CognitoIdentityPoolID) {
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: apiConfig.CognitoIdentityPoolID
        });
    }
    return AWS.config.credentials.getPromise();
}

async function invokeAwsResourceWithRole(endpoint, {
    path,
    method = "GET",
    headers = {},
    queryParams = {},
    body
}) {
    let signedRequest = null
    await getAwsCredentials();
    const client = sigV4Client.newClient({
        accessKey: AWS.config.credentials.accessKeyId,
        secretKey: AWS.config.credentials.secretAccessKey,
        sessionToken: AWS.config.credentials.sessionToken,
        region: apiConfig.get('Region') || 'eu-west-1'
    })
    signedRequest = sigV4Client.signRequest(client, {
        endpoint,
        method,
        path,
        headers,
        queryParams,
        body
    });
    body = body ? JSON.stringify(body) : body;
    headers = signedRequest.headers;
    const results = await fetch(signedRequest.url, {
        method,
        headers,
        body
    });
    if (results.status !== 200) {
        return {
            errors : {
                ...(await results.json())
            }
        }
    }
    return results.json();
}

export const executeIAM = function(path, method, data) {
    const options = {
        path: path,
        method: method,
        headers: {
            "Content-Type": "application/json"
        }
    }
    if (method === 'POST' || method === 'PUT') {
        options.body = data.body
    } else {
        options.queryParams = data
    }
    return invokeAwsResourceWithRole(apiConfig.get('ApiGatewayUrl'), options)
}

export const executeCognito = function(path, method, data, token) {
    const options = {
        method: method,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `${token}`
        }
    }
    let query = ''
    if (method === 'POST' || method === 'PUT') {
        options.body = JSON.stringify(data.body)
    } else {
        query = '?' + new URLSearchParams(data)
    }
    const url = apiConfig.get('ApiGatewayUrl') + path + query
    return fetch(url, options).then(data => data.json())
}