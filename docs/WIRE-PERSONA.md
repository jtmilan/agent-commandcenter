# Wire persona switcher into CommandCenter

`AdminConsole` and `personas` are in the repo. Add to `CommandCenter.tsx`:

```tsx
import { AdminConsole } from "./AdminConsole";
import { PERSONAS, getPersona, loadPersona, savePersona, type PersonaId } from "./personas";
import { Shield } from "lucide-react";

// state
const [persona, setPersona] = useState<PersonaId>(() =>
  typeof window !== "undefined" ? loadPersona() : "operator",
);

// header nav: when persona === "admin", include Admin tab
// header: <select> for PERSONAS
// main: {tab === "admin" && persona === "admin" && <AdminConsole onToast={flash} />}
```

`TabId` already includes `"admin"` in `types.ts`.

Dev API:

```bash
Authorization: Bearer admin|operator|viewer
```
