import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import SwaggerParser from '@apidevtools/swagger-parser';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
const api = await SwaggerParser.validate('contracts/openapi.yaml');
console.log('OpenAPI schema validation passed.');
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
// The supplied OAS 3.0 contract also uses nullable around allOf references.
// Convert that declared null alternative for JSON Schema fixture validation.
function jsonSchema(value) {
  if (Array.isArray(value)) return value.map(jsonSchema);
  if (!value || typeof value !== 'object') return value;
  const { nullable, ...rest } = value;
  const schema = Object.fromEntries(Object.entries(rest).map(([key, child]) => [key, jsonSchema(child)]));
  return nullable ? { anyOf: [schema, { type: 'null' }] } : schema;
}
const fixtures = JSON.parse(readFileSync('contracts/fixture-schema-map.json', 'utf8'));
for (const [name, schema] of Object.entries(fixtures)) {
  const validate = ajv.compile(jsonSchema(api.components.schemas[schema]));
  if (!validate(JSON.parse(readFileSync(`fixtures/public/${name}`, 'utf8')))) {
    throw new Error(`Fixture ${name}: ${ajv.errorsText(validate.errors)}`);
  }
}
console.log(`Validated ${Object.keys(fixtures).length} public request/response fixtures (no private fixtures exposed).`);
const file = 'apps/web/src/generated/api-types.ts';
const before = readFileSync(file, 'utf8');
execFileSync('npm', ['run', 'api:generate'], { stdio: 'inherit' });
if (before !== readFileSync(file, 'utf8')) {
  console.error('Generated API types changed. Review and commit the regenerated file.');
  process.exitCode = 1;
}
