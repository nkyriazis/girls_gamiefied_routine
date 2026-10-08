import { createContext } from 'react';

// A field that knows its value can't be saved reports why (null when it can), keyed by its own id; the sheet
// (CollectionEditor) keeps Αποθήκευση off while any field has a reason. Apart from fields.tsx, which exports
// only components (Fast Refresh).
export const FieldProblems = createContext<(key: string, problem: string | null) => void>(() => {});
