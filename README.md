# AWS Minify CodeGen
  
Based on [openapi-codegen](https://github.com/Mermade/openapi-codegen)

*Node.js-based codegen for OpenAPI documents. This project was initially by tailoring from openapi-codegen to use the core code generation functionality to generate the lambda based node projects and AWS CloudFormation stack.*

## Generate one solution in a serverless stack with:
+ AWS API Gateway REST API
  + AWS Secret Manager
    + AWS Lambda function 1
    + AWS Lambda function 2

## From OpenAPI specs, add extra definitions:
```yaml
openapi: 3.0.0
info:
  version: 0.0.1
  title: serverless-stack-name
x-api-gateway-name: api-gateway-restapi-name
paths:
  '/pets':
    x-lambda-service-name: lambda-function-name-per-gateway
    x-swagger-router-controller: routerControllerNamePerLambda
    get:
      tags:
        - Service Group
      description: 'Get Pets Information'
      operationId: getPets
      responses:
        '200':
          description: Success
```