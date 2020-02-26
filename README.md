**HOWTO generate a node base application base on OpenAPI Spec:**
Forked from: https://github.com/swagger-api/swagger-codegen
1. Edit ..\output\current.yaml
2. Run `npm install && npm run make-lambda`
3. project code is generated at `..\output\lambda` folder
4. Goto `..\output\lambda` folder, run `npm install && npm start`
5. Test with `demo` API: http://localhost:3000/version