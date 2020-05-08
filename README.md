# Simplify CodeGen
  
Based on [openapi-codegen](https://github.com/Mermade/openapi-codegen)

*Node.js-based codegen for OpenAPI documents. This project was initially by tailoring from openapi-codegen to use the core code generation functionality to generate the lambda based node projects and AWS CloudFormation stack.*

```
npm install -g simplify-codegen@latest
simplify-codegen generate -i spec.yaml -o ../output
```

## Purpose to have one solution in a functions stack with:
+ AWS API Gateway REST API
  + AWS Lambda function 1
    + AWS Secret Manager 1
    + DynamoDB resource 1*
    + Manage Policy Arn 1
  + AWS Lambda function 2
    + AWS Secret Manager 2
    + DynamoDB resource 2
    + Manage Policy Arn 2*
  + AWS Lambda function 3
    + AWS Secret Manager 3
    + DynamoDB resource 1*
    + Manage Policy Arn 2*

## From your existing spec.yaml, an OpenAPI specs, add extra definitions:
- `x-api-gateway-name`: to define the API gateway Rest API stack name
  - `x-api-service-name`: to define lambda function name that host the code
  - `x-api-service-model-name`: to redirect the related routing paths into a service group

[![](https://mermaid.ink/img/eyJjb2RlIjoic3RhdGVEaWFncmFtXG5cdFsqXSAtLT4gYXBpR2F0ZXdheVxuICBhcGlHYXRld2F5IC0tPiBtaWNyb1NlcnZpY2VGb3JQZXRzOiAvbWljcm9TZXJ2aWNlRm9yUGV0c1xuXHRhcGlHYXRld2F5IC0tPiBtaWNyb1NlcnZpY2VGb3JQZW9wbGU6IC9taWNyb1NlcnZpY2VGb3JQZW9wbGVcbiAgbWljcm9TZXJ2aWNlRm9yUGV0cyAtLT4gUGF0aEVycm9yczogL3Vua25vd25cbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBQYXRoRXJyb3JzOiAvdW5rbm93blxuXG5cdG1pY3JvU2VydmljZUZvclBldHMgLS0-IGxpbmtQZXRUb1BlcnNvbjogL3BldHMve2lkfVxuICBtaWNyb1NlcnZpY2VGb3JQZXRzIC0tPiBjcmVhdGVQZXQ6IC9wZXRzXG4gIG1pY3JvU2VydmljZUZvclBldHMgLS0-IGdldFBldHM6IC9wZXRzXG4gIG1pY3JvU2VydmljZUZvclBldHMgLS0-IHVwZGF0ZVBldEJ5SWQ6IC9wZXRzL3tpZH0gKCoqcHJvdGVjdGVkKiopXG5cbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBjcmVhdGVQZW9wbGU6IC9wZW9wbGVcbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBnZXRQZW9wbGU6IC9wZW9wbGVcbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBwdXRQZW9wbGU6IC9wZW9wbGVcbiAgXG4gIGNyZWF0ZVBldCAtLT4gUGV0c1xuICBnZXRQZXRzIC0tPiBQZXRzXG4gIHVwZGF0ZVBldEJ5SWQgLS0-IFBlb3BsZVBldHNcbiAgY3JlYXRlUGVvcGxlIC0tPiBQZW9wbGVQZXRzXG5cbiAgbGlua1BldFRvUGVyc29uIC0tPiBQZW9wbGVQZXRzXG4gIGdldFBlb3BsZSAtLT4gUGVvcGxlUGV0cyAgXG5cblx0UGF0aEVycm9ycyAtLT4gWypdXG4gIFBlb3BsZVBldHMgLS0-IFsqXVxuICBQZXRzIC0tPiBbKl1cblx0XHRcdFx0XHQiLCJtZXJtYWlkIjp7InRoZW1lIjoiZGVmYXVsdCJ9LCJ1cGRhdGVFZGl0b3IiOmZhbHNlfQ)](https://mermaid-js.github.io/mermaid-live-editor/#/edit/eyJjb2RlIjoic3RhdGVEaWFncmFtXG5cdFsqXSAtLT4gYXBpR2F0ZXdheVxuICBhcGlHYXRld2F5IC0tPiBtaWNyb1NlcnZpY2VGb3JQZXRzOiAvbWljcm9TZXJ2aWNlRm9yUGV0c1xuXHRhcGlHYXRld2F5IC0tPiBtaWNyb1NlcnZpY2VGb3JQZW9wbGU6IC9taWNyb1NlcnZpY2VGb3JQZW9wbGVcbiAgbWljcm9TZXJ2aWNlRm9yUGV0cyAtLT4gUGF0aEVycm9yczogL3Vua25vd25cbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBQYXRoRXJyb3JzOiAvdW5rbm93blxuXG5cdG1pY3JvU2VydmljZUZvclBldHMgLS0-IGxpbmtQZXRUb1BlcnNvbjogL3BldHMve2lkfVxuICBtaWNyb1NlcnZpY2VGb3JQZXRzIC0tPiBjcmVhdGVQZXQ6IC9wZXRzXG4gIG1pY3JvU2VydmljZUZvclBldHMgLS0-IGdldFBldHM6IC9wZXRzXG4gIG1pY3JvU2VydmljZUZvclBldHMgLS0-IHVwZGF0ZVBldEJ5SWQ6IC9wZXRzL3tpZH0gKCoqcHJvdGVjdGVkKiopXG5cbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBjcmVhdGVQZW9wbGU6IC9wZW9wbGVcbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBnZXRQZW9wbGU6IC9wZW9wbGVcbiAgbWljcm9TZXJ2aWNlRm9yUGVvcGxlIC0tPiBwdXRQZW9wbGU6IC9wZW9wbGVcbiAgXG4gIGNyZWF0ZVBldCAtLT4gUGV0c1xuICBnZXRQZXRzIC0tPiBQZXRzXG4gIHVwZGF0ZVBldEJ5SWQgLS0-IFBlb3BsZVBldHNcbiAgY3JlYXRlUGVvcGxlIC0tPiBQZW9wbGVQZXRzXG5cbiAgbGlua1BldFRvUGVyc29uIC0tPiBQZW9wbGVQZXRzXG4gIGdldFBlb3BsZSAtLT4gUGVvcGxlUGV0cyAgXG5cblx0UGF0aEVycm9ycyAtLT4gWypdXG4gIFBlb3BsZVBldHMgLS0-IFsqXVxuICBQZXRzIC0tPiBbKl1cblx0XHRcdFx0XHQiLCJtZXJtYWlkIjp7InRoZW1lIjoiZGVmYXVsdCJ9LCJ1cGRhdGVFZGl0b3IiOmZhbHNlfQ)

```yaml
openapi: 3.0.0
info:
  version: 0.0.1
  title: functions-stack-name
x-api-gateway-name: api-gateway-restapi-name
x-deployment-name: microservice-demo
x-deployment-region: eu-central-1
x-deployment-profile: your-aws-profile
x-api-hystrix-dashboard: false
paths:
  '/path-to-key':
    x-event-service-name: api-service-for-pets
    x-event-service-listen-from: path-to-s3-bucket-name
    put:
      x-event-service-model-code-plain-text:
        - module.exports.handle = function(event) {
              console.log('EVENT2:', event)
            }
      x-event-service-model-access:
        Action:
        - logs:PutLogEvents
        Resource:
        - arn:aws:logs:${AWS::Region}:${AWS::AccountId}:log-group:/aws/lambda/*:log-stream:*
      description: 'Run on event operation'
      responses:
        '200':
          description: Success
  '/pets':
    x-api-service-name: api-service-for-pets
    x-api-service-tag: devel
    get:
      x-api-service-model-list-objects: aws-s3
      x-api-service-model-list-objects-from: path-to-s3-bucket-name/path-to-key
      tags:
        - Pets Service Group
      description: 'Get Pets Information'
      operationId: getPets
      parameters:
      - name: cats
        in: query        
        schema:
          type: string
        required: false
      responses:
        '200':
          description: Success
    post:
      x-api-service-model-create-object: aws-s3
      x-api-service-model-create-object-name: path-to-s3-bucket-name/path-to-key
      x-api-service-model-create-object-data: dataObject
      tags:
        - Pets Service Group
      description: 'Create Pets Information'
      operationId: createPet
      requestBody:
        description: Optional description in *Markdown*
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                dataObject:
                  type: object
      responses:
        '200':
          description: Success
    put:
      x-api-service-model-update-object: aws-s3
      x-api-service-model-update-object-name: path-to-s3-bucket-name/path-to-key
      x-api-service-model-update-object-data: dataObject
      x-api-service-model-update-object-fields: ['foo', 'test']       
      tags:
        - Pets Service Group
      description: 'Update Pets Information'
      operationId: updatePetWithFields
      requestBody:
        description: Optional description in *Markdown*
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                dataObject:
                  type: object
      responses:
        '200':
          description: Success
  '/pets/{id}':
    x-api-service-name: api-service-for-pets
    x-api-service-model-name: people-pets
    x-api-service-hystrix-stream: true    
    post:
      x-control-service-circuit-protection: true
      x-control-service-circuit-timeout: 60000
      x-control-service-circuit-duration: 30000
      x-control-service-circuit-threshold: 0.1
      tags:
        - Pets Service Group
      description: 'Create Pets Information By Id'
      operationId: linkPetToPerson
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
    x-api-service-name: api-service-for-people
    x-api-service-model-name: people-pets
    get:
      x-api-service-model-get-object: aws-s3
      x-api-service-model-get-object-name: path-to-s3-bucket-name/path-to-key      
      x-api-service-model-get-object-fields: ['foo', 'test']
      tags:
        - People Service Group
      description: 'Get People Information'
      operationId: getPeople
      responses:
        '200':
          description: Success
    put:
      tags:
        - People Service Group
      description: 'Update People Information'
      operationId: putPeople
      responses:
        '200':
          description: Success
    post:
      tags:
        - People Service Group
      description: 'Create People Information By Id'
      operationId: createPeople
      responses:
        '200':
          description: Success
servers:
  - url: /
```

## Generate project code by using command line:

`simplify-codegen generate -i spec.yaml -o ../output/functions`

