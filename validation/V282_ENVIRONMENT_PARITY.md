# V282 Environment Parity Validation

This temporary validation artifact triggers the GitHub Actions workflow after the V282 update.

Validation scope:

- Node.js syntax checks
- Meta Quest/browser visual and movement parity audits
- One-way electric escalator enforcement
- Down escalators cannot be used to ascend
- Up escalators cannot be used to descend
- Rooftop conventional stairs remain bidirectional
- Workflow rerun after removing the package-lock cache dependency
- Diagnostic run with independent audit steps
- Strict run that stops on the first failing audit
- Rerun after updating the layered V277/V282 navigation audit
- Rerun after updating layered V278, V280 and V281 audits
- Rerun after correcting the V280 XR height assertion
- Matrix run with every audit isolated
- Final matrix rerun after updating environment, accounts and sky audits
- Final green-matrix run after updating profile persistence audit
