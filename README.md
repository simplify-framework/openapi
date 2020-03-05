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

![Diagram](https://mermaid-js.github.io/mermaid-live-editor/#/view/eyJjb2RlIjoic3RhdGVEaWFncmFtXG5cdFsqXSAtLT4gYXBpR2F0ZXdheVxuICBhcGlHYXRld2F5IC0tPiBtaWNyb1NlcnZpY2VGb3JQZXRzOiAvcGV0c1xuXHRhcGlHYXRld2F5IC0tPiBtaWNyb1NlcnZpY2VGb3JQZW9wbGU6IC9wZW9wbGVcbiAgbWljcm9TZXJ2aWNlRm9yUGV0cyAtLT4gUGF0aEVycm9yczogL3Vua25vd25cbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBQYXRoRXJyb3JzOiAvdW5rbm93blxuXG5cdG1pY3JvU2VydmljZUZvclBldHMgLS0-IGNyZWF0ZUJ5SWQ6IC9wZXRzL3tpZH1cbiAgbWljcm9TZXJ2aWNlRm9yUGV0cyAtLT4gY3JlYXRlUGV0OiAvcGV0c1xuICBtaWNyb1NlcnZpY2VGb3JQZXRzIC0tPiBnZXRQZXRzOiAvcGV0c1xuICBtaWNyb1NlcnZpY2VGb3JQZXRzIC0tPiBwdXRQZXRCeUlkOiAvcGV0cy97aWR9ICgqKnByb3RlY3RlZCoqKVxuXG4gIG1pY3JvU2VydmljZUZvclBlb3BsZSAtLT4gY3JlYXRlUGV0QnlJZDogL3Blb3BsZS97aWR9XG4gIG1pY3JvU2VydmljZUZvclBlb3BsZSAtLT4gZ2V0UGVvcGxlOiAvcGVvcGxlXG4gIG1pY3JvU2VydmljZUZvclBlb3BsZSAtLT4gcHV0UGV0czogL3BldHNcbiAgXG4gIGNyZWF0ZVBldCAtLT4gUGV0c1xuICBnZXRQZXRzIC0tPiBQZXRzXG4gIHB1dFBldEJ5SWQgLS0-IFBlb3BsZU1hbmFnZXJcbiAgY3JlYXRlQnlJZCAtLT4gUGVvcGxlTWFuYWdlclxuXG4gIGNyZWF0ZVBldEJ5SWQgLS0-IFBlb3BsZU1hbmFnZXJcbiAgZ2V0UGVvcGxlIC0tPiBQZW9wbGVNYW5hZ2VyXG4gIHB1dFBldHMgLS0-IFBlb3BsZU1hbmFnZXJcblxuXHRQYXRoRXJyb3JzIC0tPiBbKl1cbiAgUGVvcGxlTWFuYWdlciAtLT4gWypdXG4gIFBldHMgLS0-IFsqXVxuXHRcdFx0XHRcdCIsIm1lcm1haWQiOnsidGhlbWUiOiJkZWZhdWx0In0sInVwZGF0ZUVkaXRvciI6ZmFsc2V9)

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

