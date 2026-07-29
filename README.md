# BadgeMaker Bot

Public Telegram bot that composes clearly labelled sample ID-style images from user-supplied photos and exact text. Before each submission, users must confirm they have the right to create and use the image. Every image carries a prominent "SAMPLE — NOT A REAL ID" watermark and a demonstration-only footer.

Submissions are retained for audit (90 days by default), forwarded to configured admin staff for review, and can be reported as suspicious. Abuse controls allow at most five submissions per rolling 24 hours and require 30 minutes between submissions.

Spec: [`docs/blueprint.md`](docs/blueprint.md).

Built on [agnt-gm.ai](https://agnt-gm.ai). The whole bot is built and refined here as pull requests across successive build passes.
