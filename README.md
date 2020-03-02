# AWS Minify CodeGen
  
Based on [openapi-codegen](https://github.com/Mermade/openapi-codegen)

*Node.js-based codegen for OpenAPI documents. This project was initially a 24-hour hackathon. The local model adaptor code is entirely original and has been reverse-engineered from the existing documentation and template usage.*

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