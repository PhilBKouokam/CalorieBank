# Friends and Family TestFlight distribution

Product source is frozen at `aa1fc33ca15d32f9e8aa6d2e28098abe65cdd2b1`.
Distribution configuration does not authorize product or backend changes.

`preview` remains Ad Hoc internal distribution for engineering QA. `testflight`
inherits its approved environment and uses store distribution, retaining the beta
API, Clerk authentication, bundle, EAS project, HealthKit and push capabilities.
The separate production environment is not used for this external beta.

Marketing version remains 1.0.0. EAS remote version management increments iOS
build numbers without editing product source. Do not revoke existing Ad Hoc
profiles, registered devices, certificates or APNs keys.

Run `npm run release:friends-family` against the dedicated localhost test database,
then from apps/mobile run `eas build --platform ios --profile testflight`.
Submit the explicit successful store build ID, never an unrelated latest Ad Hoc
build. Reuse the existing App Store Connect record if present.

External group: Friends & Family. Individual email invitations follow Beta App
Review approval; no public link. This is not a public App Store release.
Apple authentication, missing review contact fields and legal attestations require
the account holder. Do not invent contact information or accept new agreements.

Beta description: CalorieBank helps you understand how your daily calorie choices
affect your available calorie bank over time. Connect your activity and
food-tracking sources, choose your goal, and CalorieBank calculates your bank
from completed days.

Testing focus: Please test onboarding, connecting your activity and food-tracking
sources, your Available Bank, History, source switching, and Morning Bank Update.
If something looks wrong, please take a screenshot and describe what you were doing.

Review notes must explain self-service Clerk email sign-up, required source
selections, device-controlled Apple Health permission and the possible need for
the reviewer's own source accounts. Do not promise populated health data or
unrestricted access past onboarding without verifying those conditions.

The existing ITSAppUsesNonExemptEncryption false declaration is unchanged.
New legal/compliance attestations are reserved for the account holder.
