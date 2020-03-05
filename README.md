# AWS Simplify CodeGen
  
Based on [openapi-codegen](https://github.com/Mermade/openapi-codegen)

*Node.js-based codegen for OpenAPI documents. This project was initially by tailoring from openapi-codegen to use the core code generation functionality to generate the lambda based node projects and AWS CloudFormation stack.*

## Purpose to have one solution in a serverless stack with:
+ AWS API Gateway REST API
  + AWS Secret Manager
    + AWS Lambda function 1
    + AWS Lambda function 2

## From your existing spec.yaml, an OpenAPI specs, add extra definitions:
- `x-api-gateway-name`: to define the API gateway Rest API stack name
  - `x-micro-service-name`: to define lambda function name that host the code
  - `x-micro-service-model-name`: to redirect the related routing paths into a service group

```sequence
Alice->Bob: Hello Bob, how are you?
Note right of Bob: Bob thinks
Bob-->Alice: I am good thanks!
​```

```yaml
openapi: 3.0.0
info:
  version: 0.0.1
  title: serverless-stack-name
x-api-gateway-name: api-gateway-restapi-name
x-api-hystrix-dashboard: false
paths:
  '/pets':
    x-micro-service-name: micro-service-for-pets
    get:
      tags:
        - Pets Service Group
      description: 'Get Pets Information'
      operationId: getPets
      responses:
        '200':
          description: Success
    post:
      tags:
        - Pets Service Group
      description: 'Create Pets Information'
      operationId: createPet
      responses:
        '200':
          description: Success
  '/pets/{id}':
    x-micro-service-name: micro-service-for-pets    
    x-micro-service-model-name: peopleManager
    x-micro-service-hystrix-stream: true
    put:
      x-micro-service-circuit-protection: true
      x-micro-service-circuit-timeout: 60000
      x-micro-service-circuit-duration: 30000
      x-micro-service-circuit-threshold: 0.1
      tags:
        - Pets Service Group
      description: 'Update Pets Information'
      parameters:
      - in: path
        name: id
        required: true
        schema:
            type: string
      operationId: putPetById
      responses:
        '200':
          description: Success
    post:
      tags:
        - Pets Service Group
      description: 'Create Pets Information By Id'
      operationId: createById
      parameters:
      - in: path
        name: id
        required: true
        schema:
            type: string
      - in: query
        name: filter        
        schema:
            type: string    
      requestBody:
        description: Optional description in *Markdown*
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                foo:
                  type: string
      responses:
        '200':
          description: Success
  '/people':
    x-micro-service-name: micro-service-for-people
    x-micro-service-model-name: people-manager
    get:
      tags:
        - People Service Group
      description: 'Get People Information'
      operationId: getPeople
      responses:
        '200':
          description: Success
    put:
      tags:
        - Pets Service Group
      description: 'Update Pets Information'
      operationId: putPets
      responses:
        '200':
          description: Success
    post:
      tags:
        - People Service Group
      description: 'Create People Information By Id'
      operationId: createPetById
      responses:
        '200':
          description: Success
servers:
  - url: /
```

## Generate project code by using command line:

`node cg.js serverless spec.yaml -f -o ../output/serverless`

