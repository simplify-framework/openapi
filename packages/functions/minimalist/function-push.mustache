const path = require('path')
const fs = require('fs')
const CBEGIN='\x1b[32m'
const CERROR='\x1b[31m'
const CRESET='\x1b[0m'
var nodeArgs = process.argv.slice(2);
const opName = `${CBEGIN}Simplify::${CRESET}Function`
const simplify = require('simplify-sdk')
const provider = require('simplify-sdk/provider')
var configInputFile = process.env.FUNCTION_INPUT || "function-input.json"
var configSrcDir =  process.env.FUNCTION_SOURCE || "dist"
process.env.ENFORCEMENT_PACKAGE = process.env.ENFORCEMENT_PACKAGE || ''
process.env.DEPLOYMENT_STAGE = process.env.DEPLOYMENT_STAGE || 'latest'
while (nodeArgs.length > 1) {
    if (nodeArgs[0] == "--input" || nodeArgs[0] == "-i") {
        configInputFile =  nodeArgs[1]
    } else if (nodeArgs[0] == "--src" || nodeArgs[0] == "-s") {
        configSrcDir = nodeArgs[1]
    }
    nodeArgs = nodeArgs.slice(2);
}
try {
    var config = simplify.getInputConfig(path.join(__dirname, configInputFile))
    const functionConfig = config.Function
    const bucketName = config.Bucket.Name
    const bucketKey = config.Bucket.Key
    const inputDirectory = path.join(__dirname, configSrcDir)
    const distZippedPath = path.join(__dirname, 'builds')
    const outputFilePath = path.join(distZippedPath, bucketKey)
    provider.setConfig(config).then(function() {
        simplify.uploadDirectoryAsZip({
            adaptor: provider.getStorage(), ...{
                bucketKey, inputDirectory, outputFilePath
            }
        }).then(function (uploadInfor) {
            simplify.createOrUpdateFunction({
                adaptor: provider.getFunction(),
                ...{ functionConfig, bucketName, bucketKey: uploadInfor.Key }
            }).then(function (data) {
                fs.writeFileSync(path.join(__dirname, config.OutputFile), JSON.stringify({
                    FunctionName: data.FunctionName,
                    FunctionArn: data.FunctionArn,
                    LastModified: data.LastModified,
                    CodeSha256: data.CodeSha256,
                    RevisionId: data.RevisionId,
                    LastUpdateStatus: data.LastUpdateStatus,
                    LastUpdateStatusReason: data.LastUpdateStatusReason,
                    LastUpdateStatusReasonCode: data.LastUpdateStatusReasonCode
                }, null, 4));
            }, function(err) {
                console.error(`${opName}-Update-${CERROR}ERROR${CRESET}: ${err}`);
            })
        }, function(err) {
            console.error(`${opName}-UploadZip-${CERROR}ERROR${CRESET}: ${err}`);
        })
    }).catch(function (err) {
        console.error(`${opName}-UploadDirectory: ${err}`)
    })
} catch (err) {
    console.error(`${opName}-LoadConfig: ${err}`)
}
