---
name: detective-module-readme
description: Enforce detective-department-api module README documentation. Use when Codex creates a module, adds or changes an endpoint, changes a module contract, changes a module purpose, or changes the recommended frontend flow inside src/modules/module-name.
---

# Detective Module README

## Regla

Mantener un `README.md` actualizado dentro de cada modulo ubicado en `src/modules/<module-name>/`.

Crear o actualizar el README del modulo cuando:

- Se crea un modulo nuevo.
- Se agrega un endpoint nuevo.
- Cambia el contrato de un endpoint existente.
- Cambia el proposito del modulo.
- Cambia el flujo recomendado para el frontend u otros consumidores.

## Contenido minimo

El README del modulo debe explicar como minimo:

- Para que existe el modulo.
- Que endpoints expone.
- Que headers, parametros o body requiere cada endpoint.
- Que DTOs usa cada endpoint, con nombres claros y todos los tipos de campos.
- Que respuestas devuelve.
- Como debe usarlo el frontend u otros consumidores.
- Que reglas de seguridad aplica.
- Que archivos principales forman parte del modulo.
- Que queda pendiente si el modulo aun esta incompleto.

## DTOs obligatorios por endpoint

Cada endpoint documentado debe incluir sus contratos de forma explicita. No basta con describirlos en prosa.

Documentar, segun aplique:

- Headers DTO.
- Path params DTO.
- Query DTO.
- Body DTO.
- Response DTO.

Reglas:

- Usar bloques `ts` para los DTOs.
- Incluir todos los campos con su tipo exacto.
- Marcar campos opcionales con `?`.
- Indicar unions literales cuando el contrato acepte valores cerrados.
- Indicar arrays, objetos anidados y `Record<string, unknown>` cuando correspondan.
- Si un endpoint no recibe query params o body, declararlo explicitamente con una frase corta y, si ayuda, con `Record<string, never>` o `never`.
- Mantener los nombres alineados con los DTOs reales del codigo cuando existan.
- No documentar campos que el endpoint no acepte.

## Flujo

1. Identificar que modulo bajo `src/modules/` se esta creando o cambiando.
2. Revisar si existe `src/modules/<module-name>/README.md`.
3. Crear el README si el modulo no lo tiene.
4. Actualizar solo las secciones afectadas si el README ya existe.
5. Revisar los DTOs, controller y service reales antes de escribir contratos.
6. Documentar el estado real del modulo; no prometer endpoints, contratos o reglas que no esten implementados.

Si el cambio no toca ningun modulo en `src/modules/`, no aplicar esta skill.
