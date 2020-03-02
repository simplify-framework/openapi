# AWS Minify CodeGen
  
Based on [openapi-codegen](https://github.com/Mermade/openapi-codegen)

*Node.js-based codegen for OpenAPI documents. This project was initially by tailoring from openapi-codegen to use the core code generation functionality to generate the lambda based node projects and AWS CloudFormation stack.*

## Purpose to have one solution in a serverless stack with:
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
    x-lambda-service-name: lambda-function-name-for-pets
    x-swagger-router-controller: routerControllerNameForPets
    get:
      tags:
        - Pets Service Group
      description: 'Get Pets Information'
      operationId: getPets
      responses:
        '200':
          description: Success
  '/people':
    x-lambda-service-name: lambda-function-name-for-people
    x-swagger-router-controller: routerControllerNameForPeople
    get:
      tags:
        - People Service Group
      description: 'Get People Information'
      operationId: getPeople
      responses:
        '200':
          description: Success
servers:
  - url: /
```

## Generate code by using command line:

`node cg.js serverless spec.yaml -f -o ../output/serverless`

