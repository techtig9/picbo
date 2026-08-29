# Picbo.ai — AI Provider Contract

## Objective

The frontend and business logic must not know whether a generation came from Gemini, fal.ai or another provider.

## Internal interfaces

### Text generation
Input:
- task
- system prompt
- user input
- structured output schema
- max output
- quality tier

Output:
- text/JSON
- provider
- model
- usage
- latency
- estimated cost
- request ID

### Image generation/editing
Input:
- task
- product identity
- references
- prompt
- aspect ratio
- quality
- fidelity

Output:
- asset references
- provider/model metadata
- usage/cost

### Video
Input:
- task
- images/video references
- prompt
- duration
- aspect ratio
- quality

Output:
- source media
- provider/model metadata

## Routing policy

1. Classify task.
2. Check provider/model availability.
3. Check plan eligibility.
4. Estimate cost.
5. Select the cheapest model that meets quality requirements.
6. Execute.
7. Validate result.
8. Record provider/model/cost.
9. Save asset.
10. Complete job.

Fallback is allowed only between legitimately configured provider/model options.

Never:
- rotate accounts to bypass quotas
- expose API keys in browser
- hide provider errors
- charge users for failed generations
