import { Dictionary } from "../utils/types";
import { ValidationError } from "validate";

import { actorSchema } from "./schemas/actor";
import { customFieldSchema } from "./schemas/custom_field";
import { labelSchema } from "./schemas/label";
import { markerSchema } from "./schemas/marker";
import { movieSchema } from "./schemas/movie";
import { sceneSchema } from "./schemas/scene";
import { studioSchema } from "./schemas/studio";
import { IImportedCustomField } from "./types";

export function validateImportFile(parsedFile: Dictionary<unknown>): Error[] | ValidationError[] {
  if (parsedFile.movies) {
    if (typeof parsedFile.movies !== "object" || parsedFile.movies === null)
      return [new Error(".movies needs to be a dictionary of movies (id => movie)")];

    for (const movie of Object.values(parsedFile.movies)) {
      const errors = movieSchema.validate(<Record<string, unknown>>movie);
      if (errors.length) return errors;
    }
  }

  if (parsedFile.scenes) {
    if (typeof parsedFile.scenes !== "object" || parsedFile.scenes === null)
      return [new Error(".scenes needs to be a dictionary of scenes (id => scene)")];

    for (const scene of Object.values(parsedFile.scenes)) {
      const errors = sceneSchema.validate(<Record<string, unknown>>scene);
      if (errors.length) return errors;
    }
  }

  if (parsedFile.actors) {
    if (typeof parsedFile.actors !== "object" || parsedFile.actors === null)
      return [new Error(".actors needs to be a dictionary of actors (id => actor)")];

    for (const actor of Object.values(parsedFile.actors)) {
      const errors = actorSchema.validate(<Record<string, unknown>>actor);
      if (errors.length) return errors;
    }
  }

  if (parsedFile.studios) {
    if (typeof parsedFile.studios !== "object" || parsedFile.studios === null)
      return [new Error(".studios needs to be a dictionary of studios (id => studio)")];

    for (const studio of Object.values(parsedFile.studios)) {
      const errors = studioSchema.validate(<Record<string, unknown>>studio);
      if (errors.length) return errors;
    }
  }

  if (parsedFile.labels) {
    if (typeof parsedFile.labels !== "object" || parsedFile.labels === null)
      return [new Error(".labels needs to be a dictionary of labels (id => label)")];

    for (const label of Object.values(parsedFile.labels)) {
      const errors = labelSchema.validate(<Record<string, unknown>>label);
      if (errors.length) return errors;
    }
  }

  if (parsedFile.markers) {
    if (typeof parsedFile.markers !== "object" || parsedFile.markers === null)
      return [new Error(".markers needs to be a dictionary of markers (id => marker)")];

    for (const marker of Object.values(parsedFile.markers)) {
      const errors = markerSchema.validate(<Record<string, unknown>>marker);
      if (errors.length) return errors;
    }
  }

  if (parsedFile.customFields) {
    if (typeof parsedFile.customFields !== "object" || parsedFile.customFields === null)
      return [new Error(".custom needs to be a dictionary of custom fields (id => field)")];

    for (const field of Object.values(parsedFile.customFields)) {
      const errors = customFieldSchema.validate(<Record<string, unknown>>field);
      if (errors.length) return errors;

      const _field = field as IImportedCustomField;

      if (_field.type.includes("SELECT"))
        if (!_field.values || !_field.values.length)
          return [new Error("Select field requires preset values")];
    }
  }

  return [];
}
