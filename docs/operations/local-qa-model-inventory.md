# Optional isolated QA model runtime ·2026-11-23

The agent prepared the labeled local Docker container adme-model-qa-20261123 for fictional-input CPU validation. It binds127.0.0.1:11539 only, CPU4, memory6GiB, no GPU device request, one model/parallel request and restart policy=no. This is a disposable QA runtime, not hosted infrastructure or the live worker. After testing it is stopped; the image/model volume are retained to avoid repeated downloads. No account/API key or customer source was used.

- Ollama image: ollama/ollama@sha256:ccc42bcd3d5fcf7ab0d532b300382154e1a4da56fc666bdb313b78ebdd912754; reported runtime0.40.17. [Official CPU Docker instructions](https://docs.ollama.com/docker).
- Actual requested model: qwen3:1.7b-q4_K_M, registry digest8f68893c685c3ddff2aa3fffce2aa60a30bb2da65ca488b61fff134a4d1730e7,1,359,293,444 bytes. Record the returned details/digest rather than inferring weights from the mutable tag name; this runtime reports Q4_K_M and parameter_size2.0B. A model tag is not an immutable production pin.
- Qwen LICENSE from this local model reports Apache License2.0, consistent with [Qwen's official license source](https://huggingface.co/Qwen/Qwen3-1.7B-GGUF/blob/main/LICENSE). Weights/container layers are not bundled in the repository or USER SQL ZIP; this is not a new website redistribution of a model. Existing asset/source-rights gates remain.
- embeddinggemma was not downloaded/executed in this continuation. Its model license/activation and actual embedding acceptance remain separate review gates; no embedding-model success is inferred from Qwen text generation.

Actual receipts distinguish model inference from synthetic input/rights references and local RPC bridges. A creator_provided/licensed source label in a QA function call is not a real person's consent or approved SourcePolicy. The fixture-only runner checks container label, port, CPU and absence of GPU before any stop/start, and never terminates a shared model/GPU process.
