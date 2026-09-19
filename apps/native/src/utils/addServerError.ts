// {
//   "formFields": Array [
//     Object {
//       "error": "Email is invalid",
//       "id": "email",
//     },
//   ],
//   "status": "FIELD_ERROR",
// }

import type { UseFormSetError } from "react-hook-form";

type FormFields = [{ error: string; id: string }];

export function addServerErrors(
  formFields: FormFields,
  setError: UseFormSetError<any>
) {
  for (const field of formFields) {
    setError(field.id, {
      type: "server",
      message: field.error,
    });
  }
}
