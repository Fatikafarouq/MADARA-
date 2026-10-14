# What we agreed

## MVP and users

- The MVP is an Android-only mobile app for individual dairy farmers using their own phones. It should support Android 8 or newer and be installed directly during pilot workshops.
- No account or in-app login is required. The app opens to the farmer's cow list, relies on normal phone security, and stores records locally. Losing the phone and its records is an accepted MVP limitation.
- The core workflow must work completely offline: create and update cow records, enter prediction inputs, generate results, hear guidance, review history, receive locally scheduled reminders, record actual yield and feedback, and delete data.
- The interface supports English and Hausa. Every screen has a speaker control, with replay and mute options. Speech is synthesized offline. If Hausa speech is unavailable on a device, the app clearly explains this and continues to provide Hausa text.
- The interface uses few steps, plain language, large and clear controls, and litres for milk measurements.

## Cow records and prediction inputs

- Each prediction is for one cow and covers the next seven days from whenever the farmer requests it.
- A cow can be identified in multiple ways, including a name, unique ID or ear tag, and photo. No two active cow records may share the same unique identification.
- Required prediction information includes breed, age, parity, days since calving, farmer-selected body condition score from 1 to 5, feed type, simple mastitis status, simple pregnancy status, and milking frequency. Feed quantity is optional.
- Breed and feed lists must reflect Nigerian farming conditions, be reviewed by the veterinary lecturer, and include an `Other` option with optional free text. Locally used feed choices must be represented.
- The veterinary lecturer approves valid ranges for all numeric inputs. Impossible or contradictory values must be corrected before prediction; unusual but possible values require farmer confirmation.
- Cows that have not calved or are intentionally dry cannot receive a prediction. A recent yield of zero is allowed only after confirmation and produces a strong reliability warning.
- Farmers can edit cow details and past actual-yield records. Existing predictions retain snapshots of the inputs originally used, so edits never rewrite prediction history.
- A cow can be permanently deleted after a confirmation naming the cow and warning that recovery is impossible. Deletion also removes all related predictions and actual-yield history.
- The MVP should support up to 100 active cows and at least two years of local history per phone, subject to validation on pilot devices.

## Prediction behavior and results

- The result shows one predicted total in litres for the next seven days plus a prediction range, rather than a falsely precise number alone. It also shows the cow identity, prediction dates, a plain-language confidence label, relevant contributing factors, and an explicit statement that the result is an estimate and not a guarantee or diagnosis.
- Explanations use careful language, such as saying an entered factor may affect yield, and never claim medical causation or provide a diagnosis. The veterinary lecturer reviews these explanations.
- A new cow can receive a prediction from the general model. The app warns that it is a vague estimate because little cow-specific data is available. This low-data warning remains through the first four completed prediction-versus-actual cycles; afterward, the confidence label depends on model confidence.
- If an active seven-day prediction already exists, the app shows it. A replacement prediction is permitted only after relevant information changes, and all versions remain in history.
- Results should appear offline within five seconds on the oldest supported test device.
- History includes both a chronological list and a chart, with spoken summaries.
- The result screen provides access to history, voice playback, actual-yield recording, and feedback.

## Actual yield, reminders, and feedback

- Recording actual yield is optional. When a seven-day prediction period ends, the farmer may enter the cow's actual seven-day total in litres, matching the prediction format.
- The app sends a local reminder at the end of the period, defaulting to 6:00 p.m. Farmers can change the time, turn reminders off, enter the result, ask to be reminded later, or skip it.
- If Android notification permission is denied or notifications are suppressed, an obvious `actual yield due` task remains visible inside the app.
- Farmers can describe a result as `too high`, `about right`, `too low`, or `confusing` and may add an optional note. Feedback is stored locally.

## Model, data, privacy, and updates

- The initial model uses appropriately licensed, publicly available data suited to Nigerian breeds and farming conditions. Dataset suitability, representativeness, model performance, inputs, validation ranges, and explanations require veterinary lecturer approval.
- Lack of sufficient suitable Nigerian data blocks the pilot. Foreign data may supplement, but not silently replace, local data and requires explicit veterinary lecturer approval.
- Pilot records are not automatically uploaded and do not train a shared model. The farmer may explicitly approve a manual pilot-report export during a visit.
- Exported reports replace cow and farmer identifiers with random study IDs. They include prediction values and ranges, actual totals, and optional feedback needed for evaluation.
- The app ships with a bundled offline model. Model updates are user-approved downloads. An interrupted or invalid update never replaces the last verified working model.
- A simple About screen displays the current model version and the date of the last successful update.
- Hausa terminology is reviewed by a native Hausa speaker familiar with dairy farming and checked with pilot farmers.

## Pilot and definition of done

- The pilot runs for 2–3 weeks with the planned cohort of approximately five dairy lecturers and fifteen smallholder dairy farmers. The project team and local community provide in-person support; the app does not need a remote support-contact workflow.
- The team actively encourages actual-yield recording while keeping it voluntary. Missing actual results are reported transparently and never counted as successful predictions.
- Model evaluation requires at least 50 completed cow-week prediction-versus-actual comparisons spanning multiple farms, breeds, and conditions.
- Accuracy passes when at least 70% of actual seven-day totals fall within the displayed prediction ranges and mean absolute percentage error is no more than 15%.
- At least 80% of participating farmers must generate a prediction without staff assistance after initial training.
- Retention passes when at least 70% of participants with an eligible lactating cow generate predictions in at least two separate weeks.
- At least 70% of participants must report that predictions are useful for feeding, budgeting, or milk-supply planning, and at least 60% must report improved confidence in planning.
- Functional completion requires a farmer to perform the entire core workflow offline: choose a language; create and uniquely identify a cow; enter validated data; receive and hear a prediction; review history; receive a reminder; optionally record actual yield and feedback; and permanently delete the cow and its data.
- Before pilot release, the veterinary lecturer approves the scientific elements, a native speaker approves Hausa, the app passes testing on the oldest supported Android version, and the ordinary workflow is usability-tested. These checks must not add burdens or artificial steps to normal pilot use.
- The pilot pauses immediately for dangerously implausible predictions, exposed data, corrupted records, or consistent farmer misunderstanding of predictions as guarantees. Other go/stop decisions use the accuracy, task-completion, retention, usefulness, and confidence thresholds above.

# PRD (Part 1/2)

## Problem

- **Problem statement:** Those affected are primarily dairy farmers. The pain point moment occurs when farmers make feeding, budgeting, and milk supply decisions based on expected milk production, but actual milk yield turns out to be very different from what was anticipated. This leads to poor farm planning, financial losses, and reduced profitability. The variable that needs to change is the accuracy and reliability of milk yield prediction.

- **Detailed pain point moment:** A dairy farmer inspects milk production after making feeding and budgeting decisions based on output of milk expected hoping to make a profit from milk sales , However he ends up getting lower milk production leading to uncertainty and poor farm planning
- **Root causes:** Dairy farmers struggle to make reliable farm planning decisions? Why?
Due to inaccurate milk yield predictions. Why?
Traditional ways of measurement are relied on . Why?
Accessible milk yield prediction systems are limited. Why?
Many existing technologies are expensive or not designed for low resource individuals. Why?
There is limited investment in solution for small holder farmers why?
Because the farmers view modern tools as being complex and not fit for them why?
These modern tools assume internet access and digital literacy for farmers
- **Impact gap:** Farmers are currently relying on experience and guesswork to estimate future milk yield and make farm planning decisions. What needs to improve is getting access to very easy to use prediction tools made specially for the farmers

## Target Beneficiary

- **Profile:** Target beneficiaries are dairy farmers, 35-75 years, They own and operate dairy farms handling production records feeding and sale of milk in low resource rural areas
- **Core needs:** They need to predict milk yield more accurately to make better farm management decisions.
- **Usage context:** Milk prediction is done quite regularly with some farms taking measurements every single day. The environment is low resource rural farms and constraints include low digital literacy and `limited internet connectivity

## Goals

- **Product objective:** More accurate milk yield predictions and increased profitability
- **Secondary objectives:** Improved record keeping and easier decision making
- **Theory of change:** When farmers are provided with accessible and reliable milk yield prediction systems, they can estimate future milk production more accurately and make better feeding, budgeting, and production planning decisions. More accurate predictions reduce planning errors and uncertainty, leading to improved farm management and increased profitability.

- **Non-goals:** This solution is not trying to replace all financial losses for dairy farmers or automate the farming system
- **Success metrics:** Adoption by farmers resulting in improved prediction accuracy, increase in milk production efficiency and farmer satisfaction.
# PRD (Part 2/2)

## Product

- **Functional features:** Predict weekly milk yield - Must be
Simple data entry - Must be
Easy to understand output - Must be
Works offline - Performance
Give simple prediction result - Performance
Hausa language support - Excitement
Voice guidance - Excitement

- **Non-functional requirements:** Prediction should be done across few minimal steps
Reliable milk yield prediction based on available input data.
Protect stored data from an unauthorized access
The system should have easy to understand simple interface
- **User flow summary:** 1.We introduce the application to dairy farmers through cooperatives, extension officers, veterinary clinics, and dairy institutions.
2. We host workshops teaching farmers how to install and use the application
3. Farmers register their farms and cows by entering basic information and the required production data.
4. The system generates a milk yield prediction for the following week in a format and language easy for the farmers to understand
5.Farmers use the prediction to support farm planning, such as estimating milk supply, budgeting, and monitoring production over time.
6.We monitor farmers to listen to complaints or difficulties over time
- **MVP scope and assumptions to test:** MVP : A mobile app where farmers enter cow id, input prediction data and gets milk yield prediction for next week.
Riskiest assumption: Massive adoption as farmers see this as a useful product for farm planning and management
Safeguards: Validate the model using historical prediction data, inform users that these are estimates not guarantees, protect farmer data

## Risks & Harms

- **Harms, misuse, and system failure:** 1. Risk: Farmers make important farm decisions based on inaccurate predictions.(Harm to beneficiary)
    Mitigation: Clearly state that predictions are decision support tools, not guarantees, and regularly validate the prediction model
     Monitoring signal:Large differences between predicted and actual milk yield; farmer complaints.

2.Risk : Farmers enter incorrect or incomplete data, reducing prediction accuracy. 
(Misuse)
    Mitigation: Use simple input forms, and provide clear guidance for data entry.
    Monitoring signal : High rate of incomplete or inconsistent records; unusual prediction errors.
3. Risk : The prediction model performs poorly for some breeds or farming conditions.(System Failure)
    Mitigation: Train and evaluate the model using diverse datasets and continuously improve it with new data.
     Monitoring signal : Declining prediction accuracy across specific farms, breeds, or regions.
4. Risk : Farmer data is accessed without permission.(Harm to beneficiary)
     Mitigation : Store data securely, require user authentication, and obtain user consent before collecting data.
    Monitoring signal : Reports of unauthorized access or failed security audits.
   
- **Unintended consequences:** 1.Unintended consequence : Farmers become over reliant on predictions and ignore their own experience or veterinary advice.
Mitigation : Clearly communicate that predictions are decision support tools and does not replace the farmer
Monitoring signal :Farmers report making decisions solely based on predictions or feedback indicates reduced reliance on other information sources.
2. Unintended consequence : Farmers make major financial decisions (e.g., loans or large feed purchases) based on a single prediction.
    Mitigation : Include confidence ranges and disclaimers that predictions are estimates, not guarantees.
    Monitoring signal:Reports of significant financial decisions being based only on app predictions.
3. Unintended consequences :Farmers lose trust in the system after a few inaccurate predictions and stop using it.
     Mitigation: Continuously monitor model performance, improve accuracy, and allow users to report incorrect predictions.
    Monitoring signal :Declining user retention, increasing complaints, or frequent reports of inaccurate predictions.

## Dependencies

- **Everything outside your control:** People: Farmers consistently entering accurate and complete production data.
Data: Availability of high quality and representative milk yield data for training and improving the prediction model.
Technology: Farmers having access to a compatible mobile device and sufficient power to use the application.
Policy & Legal: Compliance with data protection and privacy regulations governing the collection and storage of farmer data.
Operations: Ongoing maintenance of the prediction model, technical support, and user training where needed.

## Rollout & Pilot Plan

- **Stages:** 1.Closed Test : Test the application with a small number of sample datasets and a few dairy farmers to verify prediction accuracy, usability, and identify technical issues.
Go:  Predictions are reasonably accurate, users can complete the workflow without major difficulties, and no critical technical issues remain. 
Stop: Significant prediction errors or major usability problems are identified.
2.Small Pilot : Deploy the application with a small group of dairy farmers over several weeks to evaluate real world use and collect feedback.
Go: Farmers use the application consistently, find predictions useful for planning, and report overall satisfaction. 
Stop: Low adoption, poor user engagement, or consistently inaccurate predictions.
3. Expanded Pilot :Introduce the system to a larger group of farmers across additional communities and monitor performance under different farming conditions.
Go: The model maintains acceptable accuracy, user adoption remains high, and farmers continue to report value. 
Stop: Performance drops significantly across new environments or widespread usability issues emerge.
- **Pilot cohort:** Who : A mixed group of dairy lecturers from my campus and smallholder dairy farmers.
Where : Ahmadu Bello University dairy unit and nearby dairy farming communities in Zaria, Kaduna State
How many : Approximately 5 dairy lecturers and 15 smallholder dairy farmers.
Why this group: Dairy lecturers can evaluate the scientific validity and practicality of the prediction model, while farmers provide feedback on usability, accessibility, and whether the system fits their day-to-day farming practices. This allows both the technical performance and user experience to be assessed before wider deployment.
- **Success measures:** Metric 1 :Improvement in milk yield prediction accuracy compared with farmers' traditional estimation methods.
Metric 2	: Percentage of farmers reporting improved confidence in farm planning and management decisions after using the system.

Indicator 1: Percentage of farmers who successfully complete a prediction using the application.
Indicator 2: Percentage of farmers who continue using the application throughout the pilot (user retention).
Indicator 3: Percentage of prediction results that farmers report as useful for planning feeding, budgeting, or milk supply.
# User Flow

| # | Stage | What does the user do here? | What feature makes that possible? |
|---|---|---|---|
| 1 | Trigger | The farmer complains about inconsistent milk predictions because not only does it lead to lack of proper farm planning it also affects sales of product | Awareness of the problem through everyday farming challenges |
| 2 | Discovery | The farmer learns about the application through dairy cooperatives, extension officers, veterinarians, university outreach programs, or other farmers. | Community outreach, demonstrations, and partnerships. |
| 3 | Consideration | The farmer attends a demonstration or workshop, compares the application with current practices (experience, notebooks, or other apps), and decides whether it is useful. | Product demonstrations, simple explanations, and pilot workshops. |
| 4 | Setup | The farmer installs the application with assistance if needed, creates an account, registers the farm, and adds cows to the system. | Guided onboarding, simple registration, offline support, and local language or voice guidance. |
| 5 | Usage 1 | The farmer selects a cow and enters the required production information such as recent milk yield, breed, feed information, and lactation stage. | Simple data entry forms with clear prompts. |
| 6 | Usage 2 | The system analyzes the information and generates the predicted milk yield for the following week | AI-powered milk yield prediction engine. |
| 7 | Usage 3 | The farmer reviews the prediction and uses it to plan feeding, budgeting, milk supply, and other farm management decisions. | Prediction dashboard with easy to understand results. |
| 8 | Evaluation | The farmer compares the predicted and actual milk yield over several weeks and decides whether the system is accurate enough to trust for future planning. | Prediction history and comparison between predicted and actual yield. |
| 9 | Retention | The farmer continues entering production data each week to receive updated predictions and monitor farm performance over time. | Saved farm records, reminders, and prediction history. |
| 10 | Promotion | The farmer recommends the application to neighbouring farmers, dairy cooperatives, or farmer groups after finding it useful. | Positive user experience, community demonstrations, and referral through cooperatives and extension officers. |
