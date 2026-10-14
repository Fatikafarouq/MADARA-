import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { deleteCow, getSetting, initializeDatabase, listCows, listPredictions, listYieldLogs, recordFeedback, recordOutcome, saveCow, savePrediction, saveYieldLog, setSetting, type Cow, type Prediction, type YieldLog } from './src/db';
import { createDemoEstimate, predictionDates, validateCow, type Choice, type CowInput, type Estimate } from './src/domain';
import { translateValidationErrors, translations, type Language } from './src/translations';
import { FEED_TYPES } from './src/feeds';
import { feedCopy } from './src/feed_labels';

type Screen = 'loading' | 'language' | 'cowList' | 'cowForm' | 'predictionForm' | 'predictionResult' | 'predictionHistory' | 'actualYield' | 'yieldHistory';

type PredictionDraft = {
  age: string;
  parity: string;
  daysSinceCalving: string;
  bodyCondition: string;
  feedType: string;
  feedTypes: string[];
  feedTypeOther: string;
  feedQuantity: string;
  mastitis: Choice;
  pregnancy: Choice;
  milkingFrequency: string;
};

type UsefulnessFeedback = 'useful' | 'not_useful' | 'unsure';
type Copy = ReturnType<typeof translations>;

const emptyPredictionDraft: PredictionDraft = {
  age: '',
  parity: '',
  daysSinceCalving: '',
  bodyCondition: '',
  feedType: '',
  feedTypes: [],
  feedTypeOther: '',
  feedQuantity: '',
  mastitis: 'unsure',
  pregnancy: 'unsure',
  milkingFrequency: '',
};

const OTHER_BREED = 'Other (type breed name)';
const OTHER_FEED = 'Other';
const BREEDS = [
  'White Fulani (Bunaji)', 'Sokoto Gudali', 'Red Bororo (Rahaji)', 'Adamawa Gudali',
  'Azawak', 'Kuri', "N'Dama", 'Muturu', 'Wadara (Keteku cross)',
  'Holstein Friesian', 'Jersey', 'Girolando', 'Friesian-Zebu crossbred', OTHER_BREED,
];

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [language, setLanguage] = useState<Language>('en');
  const [cows, setCows] = useState<Cow[]>([]);
  const [editingCow, setEditingCow] = useState<Cow | null>(null);
  const [name, setName] = useState('');
  const [cowId, setCowId] = useState('');
  const [breed, setBreed] = useState('');
  const [breedOther, setBreedOther] = useState('');
  const [predictionCow, setPredictionCow] = useState<Cow | null>(null);
  const [predictionDraft, setPredictionDraft] = useState<PredictionDraft>(emptyPredictionDraft);
  const [predictionErrors, setPredictionErrors] = useState<Record<string, string>>({});
  const [demonstrationResult, setDemonstrationResult] = useState<Estimate | null>(null);
  const [currentPredictionId, setCurrentPredictionId] = useState<number | null>(null);
  const [usefulnessFeedback, setUsefulnessFeedback] = useState<UsefulnessFeedback | null>(null);
  const [predictionHistory, setPredictionHistory] = useState<Prediction[]>([]);
  const [allPredictions, setAllPredictions] = useState<Prediction[]>([]);
  const [selectedHistoryPrediction, setSelectedHistoryPrediction] = useState<Prediction | null>(null);
  const [actualYield, setActualYield] = useState('');
  const [actualYieldError, setActualYieldError] = useState('');
  const [simulateDueDate, setSimulateDueDate] = useState(false);
  const [yieldCow, setYieldCow] = useState<Cow | null>(null);
  const [yieldLogs, setYieldLogs] = useState<YieldLog[]>([]);
  const [yieldValue, setYieldValue] = useState('');
  const [yieldUnit, setYieldUnit] = useState<'litres' | 'kg'>('litres');
  const [yieldDate, setYieldDate] = useState(todayDate());
  const [yieldError, setYieldError] = useState('');

  useEffect(() => {
    async function openApp() {
      try {
        await initializeDatabase();
        const [savedLanguage, savedCows, savedPredictions] = await Promise.all([
          getSetting('language'),
          listCows(),
          listPredictions(),
        ]);
        setCows(savedCows);
        setAllPredictions(savedPredictions);
        if (savedLanguage === 'en' || savedLanguage === 'ha') setLanguage(savedLanguage);
        setScreen(savedLanguage === 'en' || savedLanguage === 'ha' ? 'cowList' : 'language');
      } catch {
        Alert.alert(translations('en').openErrorTitle, translations('en').openErrorBody);
        setScreen('language');
      }
    }

    openApp();
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'cowForm' || screen === 'predictionForm' || screen === 'predictionHistory' || screen === 'yieldHistory') {
        setScreen('cowList');
        return true;
      }
      if (screen === 'predictionResult') {
        setScreen('predictionForm');
        return true;
      }
      if (screen === 'actualYield') {
        setScreen('predictionHistory');
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [screen]);

  async function chooseLanguage(language: Language) {
    try {
      await setSetting('language', language);
      setLanguage(language);
      setScreen('cowList');
    } catch {
      const copy = translations(language);
      Alert.alert(copy.saveLanguageError, copy.tryAgain);
    }
  }

  const copy = translations(language);

  function openAddCow() {
    setEditingCow(null);
    setName('');
    setCowId('');
    setBreed('');
    setBreedOther('');
    setScreen('cowForm');
  }

  function openEditCow(cow: Cow) {
    setEditingCow(cow);
    setName(cow.name);
    setCowId(cow.cowId);
    const selection = breedSelection(cow.breed);
    setBreed(selection);
    setBreedOther(selection === OTHER_BREED ? cow.breedOther || cow.breed : cow.breedOther || '');
    setScreen('cowForm');
  }

  async function saveCowDetails() {
    if ((!name.trim() && !cowId.trim()) || !breed.trim() || (breed === OTHER_BREED && !breedOther.trim())) {
      Alert.alert(copy.missingTitle, copy.missingBody);
      return;
    }

    const cowDetails = editingCow
      ? { ...editingCow, name: name.trim(), cowId: cowId.trim(), breed: breed.trim(), breedOther: breed === OTHER_BREED ? breedOther.trim() : undefined }
      : {
          name: name.trim(),
          cowId: cowId.trim(),
          breed: breed.trim(),
          breedOther: breed === OTHER_BREED ? breedOther.trim() : undefined,
          age: 0,
          parity: 0,
          daysSinceCalving: 0,
          bodyCondition: 0,
          feedType: 'Not recorded',
          feedTypes: [],
          feedTypeOther: undefined,
          mastitis: 'unsure' as const,
          pregnancy: 'unsure' as const,
          milkingFrequency: 0,
        };

    try {
      await saveCow(cowDetails, editingCow?.id);
      setCows(await listCows());
      setScreen('cowList');
    } catch (error) {
      if (String(error).toLowerCase().includes('unique')) {
        Alert.alert(copy.duplicateTitle, copy.duplicateBody);
        return;
      }
      Alert.alert(copy.saveCowError, copy.tryAgain);
    }
  }

  function confirmPermanentCowDeletion() {
    if (!editingCow) return;
    const cowToDelete = editingCow;
    Alert.alert(
      language === 'ha' ? `A goge ${cowLabel(cowToDelete)} har abada?` : `Delete ${cowLabel(cowToDelete)} permanently?`,
      copy.deleteWarning,
      [
        { text: copy.cancel, style: 'cancel' },
        {
          text: copy.deletePermanently,
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCow(cowToDelete.id);
              const [savedCows, savedPredictions] = await Promise.all([
                listCows(),
                listPredictions(),
              ]);
              setCows(savedCows);
              setAllPredictions(savedPredictions);
              setEditingCow(null);
              setPredictionCow(null);
              setSelectedHistoryPrediction(null);
              setPredictionHistory([]);
              setDemonstrationResult(null);
              setCurrentPredictionId(null);
              setScreen('cowList');
            } catch {
              Alert.alert(copy.deleteError, copy.deleteErrorBody);
            }
          },
        },
      ],
    );
  }

  function openPredictionForm(cow: Cow) {
    setPredictionCow(cow);
    setPredictionDraft({
      age: cow.age > 0 ? String(cow.age) : '',
      parity: cow.parity > 0 ? String(cow.parity) : '',
      daysSinceCalving: cow.daysSinceCalving > 0 ? String(cow.daysSinceCalving) : '',
      bodyCondition: cow.bodyCondition > 0 ? String(cow.bodyCondition) : '',
      feedType: cow.feedType === 'Not recorded' ? '' : cow.feedType,
      feedTypes: cow.feedTypes?.filter((feed) => feed !== 'Not recorded') || [],
      feedTypeOther: cow.feedTypeOther || '',
      feedQuantity: cow.feedQuantity == null ? '' : String(cow.feedQuantity),
      mastitis: cow.mastitis,
      pregnancy: cow.pregnancy,
      milkingFrequency: cow.milkingFrequency > 0 ? String(cow.milkingFrequency) : '',
    });
    setPredictionErrors({});
    setScreen('predictionForm');
  }

  async function openYieldHistory(cow: Cow) {
    try {
      setYieldCow(cow);
      setYieldLogs(await listYieldLogs(cow.id));
      setYieldValue('');
      setYieldUnit('litres');
      setYieldDate(todayDate());
      setYieldError('');
      setScreen('yieldHistory');
    } catch {
      Alert.alert(copy.yieldHistoryError, copy.tryAgain);
    }
  }

  async function addYieldLog() {
    if (!yieldCow) return;
    const value = Number(yieldValue);
    if (!Number.isFinite(value) || value <= 0 || value > 5000 || !validDate(yieldDate)) {
      setYieldError(copy.yieldLogValidation);
      return;
    }
    try {
      await saveYieldLog(yieldCow.id, yieldDate, value, yieldUnit);
      setYieldLogs(await listYieldLogs(yieldCow.id));
      setYieldValue('');
      setYieldDate(todayDate());
      setYieldError('');
    } catch {
      Alert.alert(copy.yieldSaveError, copy.tryAgain);
    }
  }

  async function openPredictionHistory(cow: Cow) {
    try {
      setPredictionCow(cow);
      setPredictionHistory(await listPredictions(cow.id));
      setScreen('predictionHistory');
    } catch {
      Alert.alert(copy.historyError, copy.tryAgain);
    }
  }

  function openActualYield(prediction: Prediction) {
    setSelectedHistoryPrediction(prediction);
    setActualYield(prediction.actualTotal == null ? '' : String(prediction.actualTotal));
    setActualYieldError('');
    setScreen('actualYield');
  }

  function openActualYieldTask(prediction: Prediction) {
    const cow = cows.find((item) => item.id === prediction.cowId);
    if (!cow) {
      Alert.alert(copy.cowNotFound, copy.taskOpenError);
      return;
    }
    setPredictionCow(cow);
    openActualYield(prediction);
  }

  async function saveActualYield() {
    if (!selectedHistoryPrediction || !predictionCow) return;
    const value = Number(actualYield);
    if (!actualYield.trim() || !Number.isFinite(value) || value < 0 || value > 5000) {
      setActualYieldError(copy.actualYieldValidation);
      return;
    }

    try {
      await recordOutcome(selectedHistoryPrediction.id, value, '', '');
      const [cowHistory, completeHistory] = await Promise.all([
        listPredictions(predictionCow.id),
        listPredictions(),
      ]);
      setPredictionHistory(cowHistory);
      setAllPredictions(completeHistory);
      setScreen('predictionHistory');
    } catch {
      Alert.alert(copy.actualSaveError, copy.tryAgain);
    }
  }

  async function saveUsefulnessFeedback(feedback: UsefulnessFeedback) {
    if (currentPredictionId == null) return;
    try {
      await recordFeedback(currentPredictionId, feedback);
      setUsefulnessFeedback(feedback);
    } catch {
      Alert.alert(copy.feedbackSaveError, copy.tryAgain);
    }
  }

  async function submitPredictionInputs() {
    if (!predictionCow) return;

    const input: CowInput = {
      ...predictionCow,
      age: Number(predictionDraft.age),
      parity: Number(predictionDraft.parity),
      daysSinceCalving: Number(predictionDraft.daysSinceCalving),
      bodyCondition: Number(predictionDraft.bodyCondition),
      feedType: modelFeedType(predictionDraft.feedTypes),
      feedTypes: predictionDraft.feedTypes,
      feedTypeOther: predictionDraft.feedTypes.includes(OTHER_FEED) ? predictionDraft.feedTypeOther.trim() : undefined,
      feedQuantity: predictionDraft.feedQuantity.trim() ? Number(predictionDraft.feedQuantity) : undefined,
      mastitis: predictionDraft.mastitis,
      pregnancy: predictionDraft.pregnancy,
      milkingFrequency: Number(predictionDraft.milkingFrequency),
    };
    const errors = translateValidationErrors(validateCow(input), language);
    setPredictionErrors(errors);
    if (Object.keys(errors).length > 0) {
      Alert.alert(copy.formTitle, copy.formBody);
      return;
    }

    try {
      await saveCow(input, predictionCow.id);
      setCows(await listCows());
      const estimate = createDemoEstimate(input);
      const dates = predictionDates();
      const predictionId = await savePrediction(predictionCow.id, input, estimate, dates.start, dates.end);
      setAllPredictions(await listPredictions());
      setPredictionCow({ ...predictionCow, ...input });
      setDemonstrationResult(estimate);
      setCurrentPredictionId(predictionId);
      setUsefulnessFeedback(null);
      setScreen('predictionResult');
    } catch {
      Alert.alert(copy.inputsSaveError, copy.tryAgain);
    }
  }

  if (screen === 'loading') {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#176B3A" />
      </SafeAreaView>
    );
  }

  if (screen === 'language') {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <StatusBar style="dark" />
        <View style={styles.content}>
          <Text style={styles.title}>{copy.chooseLanguage}</Text>
          <Text style={styles.subtitle}>{copy.languageSubtitle}</Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => chooseLanguage('en')}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>{copy.english}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => chooseLanguage('ha')}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>{copy.hausa}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'cowForm') {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Text style={styles.title}>{editingCow ? copy.editCow : copy.addCow}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>{copy.cowName}</Text>
          <TextInput
            accessibilityLabel={copy.cowName}
            autoCapitalize="words"
            onChangeText={setName}
            style={styles.input}
            value={name}
          />

          <Text style={styles.label}>{copy.cowId}</Text>
          <TextInput
            accessibilityLabel={copy.cowIdAccessibility}
            autoCapitalize="characters"
            onChangeText={setCowId}
            style={styles.input}
            value={cowId}
          />

          <Text style={styles.label}>{copy.breed}</Text>
          <SelectMenu
            label={copy.selectBreed}
            options={BREEDS}
            value={breed}
            onChange={(value) => {
              setBreed(value);
              if (value !== OTHER_BREED) setBreedOther('');
            }}
          />
          {breed === OTHER_BREED && (
            <TextInput
              accessibilityLabel={copy.otherBreed}
              autoCapitalize="words"
              onChangeText={setBreedOther}
              placeholder={copy.otherBreed}
              style={styles.input}
              value={breedOther}
            />
          )}

          <Pressable
            accessibilityRole="button"
            onPress={saveCowDetails}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>{copy.saveCow}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setScreen('cowList')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.secondaryButtonText}>{copy.cancel}</Text>
          </Pressable>

          {editingCow && (
            <Pressable
              accessibilityRole="button"
              onPress={confirmPermanentCowDeletion}
              style={({ pressed }) => [styles.deleteButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.deleteButtonText}>{copy.deleteCowPermanently}</Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'predictionForm' && predictionCow) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Text style={styles.title}>{copy.predictionInputs}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <View style={styles.selectedCowCard}>
            <Text style={styles.cowName}>{cowLabel(predictionCow)}</Text>
            <Text style={styles.cowBreed}>{displayBreed(predictionCow)}</Text>
          </View>

          <PredictionField label={copy.age} value={predictionDraft.age} error={predictionErrors.age} onChange={(value) => setPredictionDraft({ ...predictionDraft, age: value })} />
          <PredictionField label={copy.parity} value={predictionDraft.parity} error={predictionErrors.parity} onChange={(value) => setPredictionDraft({ ...predictionDraft, parity: value })} />
          <PredictionField label={copy.daysSinceCalving} value={predictionDraft.daysSinceCalving} error={predictionErrors.daysSinceCalving} onChange={(value) => setPredictionDraft({ ...predictionDraft, daysSinceCalving: value })} />
          <Text style={styles.label}>{copy.bodyCondition}</Text>
          <NumberChoices options={[1, 2, 3, 4, 5]} value={predictionDraft.bodyCondition} onChange={(value) => setPredictionDraft({ ...predictionDraft, bodyCondition: value })} />
          {predictionErrors.bodyCondition && <Text style={styles.errorText}>{predictionErrors.bodyCondition}</Text>}

          <Text style={styles.label}>{copy.feedType}</Text>
          <MultiSelect
            options={FEED_TYPES}
            values={predictionDraft.feedTypes}
            onChange={(values) => setPredictionDraft({ ...predictionDraft, feedTypes: values, feedTypeOther: values.includes(OTHER_FEED) ? predictionDraft.feedTypeOther : '' })}
          />
          {predictionErrors.feedType && <Text style={styles.errorText}>{predictionErrors.feedType}</Text>}
          {predictionDraft.feedTypes.includes(OTHER_FEED) && (
            <TextInput
              accessibilityLabel={copy.otherFeedType}
              autoCapitalize="words"
              onChangeText={(value) => setPredictionDraft({ ...predictionDraft, feedTypeOther: value })}
              placeholder={copy.otherFeedType}
              style={[styles.input, predictionErrors.feedTypeOther && styles.invalidInput]}
              value={predictionDraft.feedTypeOther}
            />
          )}
          {predictionErrors.feedTypeOther && <Text style={styles.errorText}>{predictionErrors.feedTypeOther}</Text>}

          <PredictionField label={copy.feedQuantity} value={predictionDraft.feedQuantity} error={predictionErrors.feedQuantity} onChange={(value) => setPredictionDraft({ ...predictionDraft, feedQuantity: value })} />

          <Text style={styles.label}>{copy.mastitis}</Text>
          <ChoiceButtons copy={copy} value={predictionDraft.mastitis} onChange={(value) => setPredictionDraft({ ...predictionDraft, mastitis: value })} />

          <Text style={styles.label}>{copy.pregnancy}</Text>
          <ChoiceButtons copy={copy} value={predictionDraft.pregnancy} onChange={(value) => setPredictionDraft({ ...predictionDraft, pregnancy: value })} />

          <Text style={styles.label}>{copy.milkingFrequency}</Text>
          <NumberChoices options={[1, 2, 3, 4]} value={predictionDraft.milkingFrequency} onChange={(value) => setPredictionDraft({ ...predictionDraft, milkingFrequency: value })} />
          {predictionErrors.milkingFrequency && <Text style={styles.errorText}>{predictionErrors.milkingFrequency}</Text>}

          <Pressable
            accessibilityRole="button"
            onPress={submitPredictionInputs}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>{copy.saveInputs}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setScreen('cowList')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.secondaryButtonText}>{copy.cancel}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'predictionResult' && predictionCow && demonstrationResult) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Text style={styles.title}>{copy.demonstrationResult}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.resultContent}>
          <View style={styles.prototypeLabel}>
            <Text style={styles.prototypeLabelText}>{copy.prototypeLabel}</Text>
            <Text style={styles.safetyWarningText}>{copy.safetyWarning}</Text>
          </View>

          <Text style={styles.resultCowName}>{cowLabel(predictionCow)}</Text>
          <Text style={styles.resultCaption}>{copy.predictedSevenDays}</Text>
          <Text style={styles.resultTotal}>{demonstrationResult.total} {copy.litres}</Text>
          <Text style={styles.resultRange}>{copy.range}: {demonstrationResult.low}–{demonstrationResult.high} {copy.litres}</Text>
          {demonstrationResult.lowConfidenceBreed && (
            <Text style={styles.comparisonWarning}>Low-confidence breed estimate. Use the range, not the total alone.</Text>
          )}

          <View style={styles.explanationCard}>
            <Text style={styles.explanationTitle}>{copy.whatNumberMeans}</Text>
            <Text style={styles.explanationText}>{demonstrationResult.method === 'breed_curve'
              ? demonstrationResult.feedAdjustment?.score != null ? feedCopy(language).curveExplanation : copy.breedCurveExplanation
              : copy.resultExplanation}</Text>
          </View>

          {demonstrationResult.feedAdjustment && (
            <View style={styles.explanationCard}>
              <Text style={styles.explanationTitle}>{feedCopy(language).heading}</Text>
              {demonstrationResult.feedAdjustment.score !== null && (
                <Text style={styles.factorText}>{feedCopy(language).score}: {demonstrationResult.feedAdjustment.score.toFixed(1)} / 10</Text>
              )}
              <Text style={styles.factorText}>{feedCopy(language).adjustment}: {Number(((demonstrationResult.feedAdjustment.multiplier - 1) * 100).toFixed(1))}%</Text>
              <Text style={styles.explanationText}>{feedCopy(language).approximate}</Text>
              {demonstrationResult.feedAdjustment.unscoredFeeds.length > 0 && (
                <Text style={styles.explanationText}>{feedCopy(language).unscored}</Text>
              )}
              {demonstrationResult.feedAdjustment.safetyRisk && (
                <Text style={styles.explanationText}>{feedCopy(language).safetyReduction}</Text>
              )}
            </View>
          )}

          <View style={styles.explanationCard}>
            <Text style={styles.explanationTitle}>{copy.mainFactors}</Text>
            {demonstrationResult.factors.map((factor) => (
              <Text key={factor} style={styles.factorText}>• {translatedFactor(factor, copy)}</Text>
            ))}
          </View>

          <View style={styles.explanationCard}>
            <Text style={styles.explanationTitle}>{copy.researchFactors}</Text>
            <Text style={styles.factorText}>• {copy.researchFeed}</Text>
            <Text style={styles.factorText}>• {copy.researchBodyCondition}</Text>
            <Text style={styles.factorText}>• {copy.researchMilking}</Text>
            <Text style={styles.comparisonWarning}>{copy.researchWarning}</Text>
          </View>

          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>{copy.wasUseful}</Text>
            <View style={styles.feedbackChoices}>
              {([
                ['useful', copy.useful],
                ['not_useful', copy.notUseful],
                ['unsure', copy.notSure],
              ] as const).map(([value, label]) => (
                <Pressable
                  accessibilityRole="button"
                  key={value}
                  onPress={() => saveUsefulnessFeedback(value)}
                  style={[styles.feedbackButton, usefulnessFeedback === value && styles.feedbackButtonSelected]}
                >
                  <Text style={[styles.feedbackButtonText, usefulnessFeedback === value && styles.feedbackButtonTextSelected]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            {usefulnessFeedback && <Text style={styles.feedbackSaved}>{copy.saved}: {feedbackLabel(usefulnessFeedback, copy)}</Text>}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => setScreen('cowList')}
            style={({ pressed }) => [styles.button, styles.resultButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>{copy.backToCowList}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'yieldHistory' && yieldCow) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Text style={styles.title}>{copy.milkYield}</Text>
          <Text style={styles.subtitleSmall}>{cowLabel(yieldCow)} · {displayBreed(yieldCow)}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <View style={styles.logCard}>
            <Text style={styles.sectionTitle}>{copy.logMilkYield}</Text>
            <Text style={styles.label}>{copy.yieldAmount}</Text>
            <TextInput
              accessibilityLabel={copy.yieldAmount}
              keyboardType="decimal-pad"
              onChangeText={setYieldValue}
              placeholder="0"
              style={[styles.input, yieldError && styles.invalidInput]}
              value={yieldValue}
            />
            <Text style={styles.label}>{copy.unit}</Text>
            <View style={styles.choiceRow}>
              {(['litres', 'kg'] as const).map((unit) => (
                <Pressable key={unit} onPress={() => setYieldUnit(unit)} style={[styles.choiceButton, yieldUnit === unit && styles.choiceButtonSelected]}>
                  <Text style={[styles.choiceText, yieldUnit === unit && styles.choiceTextSelected]}>{unit === 'litres' ? copy.litres : copy.kilograms}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>{copy.date}</Text>
            <TextInput
              accessibilityLabel={copy.date}
              keyboardType="numbers-and-punctuation"
              onChangeText={setYieldDate}
              placeholder="YYYY-MM-DD"
              style={[styles.input, yieldError && styles.invalidInput]}
              value={yieldDate}
            />
            {yieldError && <Text style={styles.errorText}>{yieldError}</Text>}
            <Pressable onPress={addYieldLog} style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
              <Text style={styles.buttonText}>{copy.saveYield}</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>{copy.yieldHistory}</Text>
          {yieldLogs.length === 0 ? <Text style={styles.emptyText}>{copy.noYieldLogs}</Text> : yieldLogs.map((entry) => (
            <View key={entry.id} style={styles.yieldRow}>
              <Text style={styles.historyDate}>{formatYieldDate(entry.yieldDate, language)}</Text>
              <Text style={styles.yieldValue}>{entry.yieldValue} {entry.yieldUnit === 'litres' ? copy.litres : copy.kilograms}</Text>
            </View>
          ))}
          <Pressable onPress={() => setScreen('cowList')} style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}>
            <Text style={styles.secondaryButtonText}>{copy.backToCowList}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'predictionHistory' && predictionCow) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Text style={styles.title}>{copy.predictionHistory}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.historyList}>
          <View style={styles.selectedCowCard}>
            <Text style={styles.cowName}>{cowLabel(predictionCow)}</Text>
            <Text style={styles.cowBreed}>{displayBreed(predictionCow)}</Text>
          </View>

          {predictionHistory.length === 0 ? (
            <Text style={styles.emptyText}>{copy.noPredictions}</Text>
          ) : (
            predictionHistory.map((prediction) => (
              <Pressable
                accessibilityRole="button"
                key={prediction.id}
                onPress={() => openActualYield(prediction)}
                style={({ pressed }) => [styles.historyCard, pressed && styles.buttonPressed]}
              >
                <Text style={styles.historyDate}>{formatTimestamp(prediction.createdAt, language)}</Text>
                <Text style={styles.historyTotal}>{prediction.total} {copy.litres}</Text>
                <Text style={styles.historyRange}>{copy.range}: {prediction.low}–{prediction.high} {copy.litres}</Text>
                <Text style={prediction.actualTotal == null ? styles.actualMissing : styles.actualSaved}>
                  {prediction.actualTotal == null ? copy.noActualYield : `${copy.actual}: ${prediction.actualTotal} ${copy.litres}`}
                </Text>
                <Text style={prediction.feedback == null ? styles.feedbackMissing : styles.feedbackHistory}>
                  {prediction.feedback == null ? copy.noFeedback : `${copy.usefulness}: ${feedbackLabel(prediction.feedback, copy)}`}
                </Text>
                <Text style={styles.historyHint}>{copy.tapActualYield}</Text>
              </Pressable>
            ))
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() => setScreen('cowList')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.secondaryButtonText}>{copy.backToCowList}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (screen === 'actualYield' && predictionCow && selectedHistoryPrediction) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Text style={styles.title}>{copy.actualYield}</Text>
        </View>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <View style={styles.selectedCowCard}>
            <Text style={styles.cowName}>{cowLabel(predictionCow)}</Text>
            <Text style={styles.historyDate}>{formatTimestamp(selectedHistoryPrediction.createdAt, language)}</Text>
            <Text style={styles.historyTotal}>{copy.predicted}: {selectedHistoryPrediction.total} {copy.litres}</Text>
            <Text style={styles.historyRange}>{copy.range}: {selectedHistoryPrediction.low}–{selectedHistoryPrediction.high} {copy.litres}</Text>
          </View>

          <Text style={styles.label}>{copy.actualSevenDays}</Text>
          <TextInput
            accessibilityLabel={copy.actualSevenDays}
            keyboardType="decimal-pad"
            onChangeText={(value) => {
              setActualYield(value);
              setActualYieldError('');
            }}
            style={[styles.input, actualYieldError && styles.invalidInput]}
            value={actualYield}
          />
          {actualYieldError && <Text style={styles.errorText}>{actualYieldError}</Text>}

          <Pressable
            accessibilityRole="button"
            onPress={saveActualYield}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>{copy.saveActualYield}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setScreen('predictionHistory')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.secondaryButtonText}>{copy.cancel}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const effectiveNow = new Date(Date.now() + (simulateDueDate ? 8 * 24 * 60 * 60 * 1000 : 0));
  const duePredictions = allPredictions.filter(
    (prediction) => prediction.actualTotal == null && new Date(prediction.periodEnd) <= effectiveNow,
  );

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>{copy.cowList}</Text>
      </View>
      {__DEV__ && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setSimulateDueDate((current) => !current)}
          style={styles.testDueButton}
        >
          <Text style={styles.testDueButtonText}>{simulateDueDate ? copy.testToday : copy.testAdvance}</Text>
        </Pressable>
      )}
      {duePredictions.length > 0 && (
        <View style={styles.dueSection}>
          <Text style={styles.dueSectionTitle}>{copy.actualYieldDue}</Text>
          {duePredictions.map((prediction) => (
            <View key={prediction.id} style={styles.dueTask}>
              <Text style={styles.dueCowName}>{prediction.cowName}</Text>
              <Text style={styles.dueDetails}>{copy.due}: {formatDate(prediction.periodEnd, language)}</Text>
              <Text style={styles.dueDetails}>{copy.predicted}: {prediction.total} {copy.litres}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => openActualYieldTask(prediction)}
                style={({ pressed }) => [styles.dueAction, pressed && styles.buttonPressed]}
              >
                <Text style={styles.dueActionText}>{copy.enterActualYield}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {cows.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{copy.noCows}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.cowList}>
          {cows.map((cow) => (
            <View key={cow.id} style={styles.cowCard}>
              <Pressable
                accessibilityRole="button"
                onPress={() => openPredictionForm(cow)}
                style={({ pressed }) => pressed && styles.buttonPressed}
              >
                <Text style={styles.cowName}>{cowLabel(cow)}</Text>
                <Text style={styles.cowBreed}>{displayBreed(cow)}</Text>
                <Text style={styles.selectHint}>{copy.tapPredictionInputs}</Text>
              </Pressable>
              <View style={styles.cowActions}>
                <Pressable accessibilityRole="button" onPress={() => openEditCow(cow)}>
                  <Text style={styles.editLink}>{copy.editCowDetails}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => openPredictionHistory(cow)}>
                  <Text style={styles.editLink}>{copy.predictionHistory}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => openYieldHistory(cow)}>
                  <Text style={styles.editLink}>{copy.milkYield}</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setScreen('language')}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.secondaryButtonText}>{copy.backToLanguage}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={openAddCow}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <Text style={styles.buttonText}>{copy.addCow}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F7FAF7',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 24,
    gap: 14,
  },
  title: {
    color: '#153B25',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: '#607268',
    fontSize: 18,
    marginBottom: 18,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#176B3A',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 20,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomColor: '#DCE7DF',
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#607268',
    fontSize: 18,
  },
  cowList: {
    gap: 12,
    padding: 20,
  },
  cowCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DCE7DF',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  cowName: {
    color: '#153B25',
    fontSize: 19,
    fontWeight: '800',
  },
  cowBreed: {
    color: '#607268',
    fontSize: 16,
    marginTop: 4,
  },
  selectHint: {
    color: '#176B3A',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
  },
  editLink: {
    color: '#176B3A',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 14,
    paddingVertical: 6,
  },
  cowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopColor: '#DCE7DF',
    borderTopWidth: 1,
    gap: 10,
    padding: 16,
  },
  testDueButton: {
    alignSelf: 'center',
    backgroundColor: '#EEF2F0',
    borderRadius: 20,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  testDueButtonText: {
    color: '#355441',
    fontSize: 13,
    fontWeight: '700',
  },
  dueSection: {
    backgroundColor: '#FFF8E5',
    borderColor: '#E5B43B',
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
  },
  dueSectionTitle: {
    color: '#684600',
    fontSize: 19,
    fontWeight: '900',
  },
  dueTask: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
  },
  dueCowName: {
    color: '#153B25',
    fontSize: 17,
    fontWeight: '800',
  },
  dueDetails: {
    color: '#607268',
    fontSize: 14,
    marginTop: 4,
  },
  dueAction: {
    alignItems: 'center',
    backgroundColor: '#176B3A',
    borderRadius: 10,
    marginTop: 12,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dueActionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  form: {
    gap: 10,
    padding: 20,
  },
  label: {
    color: '#153B25',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  subtitleSmall: {
    color: '#607268',
    fontSize: 16,
    marginTop: 5,
    textAlign: 'center',
  },
  selectButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#AFC3B5',
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 14,
  },
  selectButtonText: {
    color: '#172B1E',
    flex: 1,
    fontSize: 17,
  },
  placeholderText: {
    color: '#607268',
  },
  optionList: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DCE7DF',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  optionButton: {
    borderBottomColor: '#DCE7DF',
    borderBottomWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  optionButtonSelected: {
    backgroundColor: '#E7F4EB',
  },
  optionText: {
    color: '#153B25',
    fontSize: 16,
  },
  optionTextSelected: {
    color: '#176B3A',
    fontWeight: '800',
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DCE7DF',
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  sectionTitle: {
    color: '#153B25',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 8,
  },
  yieldRow: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DCE7DF',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  yieldValue: {
    color: '#176B3A',
    fontSize: 18,
    fontWeight: '900',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#AFC3B5',
    borderRadius: 12,
    borderWidth: 1.5,
    color: '#172B1E',
    fontSize: 17,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  invalidInput: {
    borderColor: '#B42318',
  },
  errorText: {
    color: '#B42318',
    fontSize: 13,
  },
  selectedCowCard: {
    backgroundColor: '#E7F4EB',
    borderRadius: 14,
    marginBottom: 4,
    padding: 16,
  },
  resultContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  prototypeLabel: {
    backgroundColor: '#FFF0C2',
    borderColor: '#C68A00',
    borderRadius: 14,
    borderWidth: 2,
    marginBottom: 30,
    padding: 16,
    width: '100%',
  },
  prototypeLabelText: {
    color: '#684600',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 25,
    textAlign: 'center',
  },
  safetyWarningText: {
    color: '#684600',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 23,
    marginTop: 12,
    textAlign: 'center',
  },
  resultCowName: {
    color: '#153B25',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
  },
  resultCaption: {
    color: '#607268',
    fontSize: 16,
    textAlign: 'center',
  },
  resultTotal: {
    color: '#176B3A',
    fontSize: 40,
    fontWeight: '900',
    marginTop: 8,
  },
  resultRange: {
    color: '#355441',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
  },
  explanationCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DCE7DF',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 28,
    padding: 16,
    width: '100%',
  },
  explanationTitle: {
    color: '#153B25',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  explanationText: {
    color: '#355441',
    fontSize: 16,
    lineHeight: 23,
  },
  factorText: {
    color: '#355441',
    fontSize: 16,
    lineHeight: 23,
    marginTop: 6,
  },
  comparisonWarning: {
    color: '#684600',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: 12,
  },
  feedbackCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DCE7DF',
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 16,
    padding: 16,
    width: '100%',
  },
  feedbackTitle: {
    color: '#153B25',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  feedbackChoices: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  feedbackButton: {
    alignItems: 'center',
    borderColor: '#AFC3B5',
    borderRadius: 12,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    padding: 6,
  },
  feedbackButtonSelected: {
    backgroundColor: '#176B3A',
    borderColor: '#176B3A',
  },
  feedbackButtonText: {
    color: '#355441',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  feedbackButtonTextSelected: {
    color: '#FFFFFF',
  },
  feedbackSaved: {
    color: '#176B3A',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 12,
    textAlign: 'center',
  },
  resultButton: {
    marginTop: 36,
    width: '100%',
  },
  historyList: {
    gap: 12,
    padding: 20,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#DCE7DF',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  historyDate: {
    color: '#607268',
    fontSize: 14,
  },
  historyTotal: {
    color: '#176B3A',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 8,
  },
  historyRange: {
    color: '#355441',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  actualMissing: {
    color: '#607268',
    fontSize: 15,
    fontStyle: 'italic',
    marginTop: 12,
  },
  actualSaved: {
    color: '#153B25',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 12,
  },
  historyHint: {
    color: '#176B3A',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
  },
  feedbackMissing: {
    color: '#607268',
    fontSize: 15,
    fontStyle: 'italic',
    marginTop: 8,
  },
  feedbackHistory: {
    color: '#153B25',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 8,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  choiceButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#AFC3B5',
    borderRadius: 12,
    borderWidth: 1.5,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    padding: 8,
  },
  choiceButtonSelected: {
    backgroundColor: '#176B3A',
    borderColor: '#176B3A',
  },
  choiceText: {
    color: '#355441',
    fontWeight: '700',
    textAlign: 'center',
  },
  choiceTextSelected: {
    color: '#FFFFFF',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#176B3A',
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    color: '#176B3A',
    fontSize: 18,
    fontWeight: '800',
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#B42318',
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: 'center',
    marginTop: 18,
    minHeight: 56,
    paddingHorizontal: 20,
  },
  deleteButtonText: {
    color: '#B42318',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
});

function PredictionField({ label, value, error, onChange }: { label: string; value: string; error?: string; onChange: (value: string) => void }) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType="decimal-pad"
        onChangeText={onChange}
        style={[styles.input, error && styles.invalidInput]}
        value={value}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </>
  );
}

function ChoiceButtons({ copy, value, onChange }: { copy: Copy; value: Choice; onChange: (value: Choice) => void }) {
  const choices: { value: Choice; label: string }[] = [
    { value: 'yes', label: copy.yes },
    { value: 'no', label: copy.no },
    { value: 'unsure', label: copy.notSure },
  ];

  return (
    <View style={styles.choiceRow}>
      {choices.map((choice) => (
        <Pressable
          accessibilityRole="button"
          key={choice.value}
          onPress={() => onChange(choice.value)}
          style={[styles.choiceButton, value === choice.value && styles.choiceButtonSelected]}
        >
          <Text style={[styles.choiceText, value === choice.value && styles.choiceTextSelected]}>{choice.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function NumberChoices({ options, value, onChange }: { options: number[]; value: string; onChange: (value: string) => void }) {
  return (
    <View style={styles.choiceRow}>
      {options.map((option) => {
        const selected = value === String(option);
        return (
          <Pressable key={option} onPress={() => onChange(String(option))} style={[styles.choiceButton, selected && styles.choiceButtonSelected]}>
            <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SelectMenu({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen((current) => !current)} style={styles.selectButton}>
        <Text style={[styles.selectButtonText, !value && styles.placeholderText]}>{value || label}</Text>
        <Text>⌄</Text>
      </Pressable>
      {open && (
        <View style={styles.optionList}>
          {options.map((option) => (
            <Pressable
              key={option}
              onPress={() => { onChange(option); setOpen(false); }}
              style={[styles.optionButton, value === option && styles.optionButtonSelected]}
            >
              <Text style={[styles.optionText, value === option && styles.optionTextSelected]}>{option}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function MultiSelect({ options, values, onChange }: { options: string[]; values: string[]; onChange: (values: string[]) => void }) {
  return (
    <View style={styles.optionList}>
      {options.map((option) => {
        const selected = values.includes(option);
        return (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            key={option}
            onPress={() => onChange(selected ? values.filter((value) => value !== option) : [...values, option])}
            style={[styles.optionButton, selected && styles.optionButtonSelected]}
          >
            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{selected ? '✓ ' : ''}{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function formatTimestamp(timestamp: string, language: Language): string {
  return new Date(timestamp).toLocaleString(language === 'ha' ? 'ha-NG' : 'en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(timestamp: string, language: Language): string {
  return new Date(timestamp).toLocaleDateString(language === 'ha' ? 'ha-NG' : 'en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function todayDate(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function formatYieldDate(value: string, language: Language): string {
  return formatDate(`${value}T12:00:00`, language);
}

function breedSelection(value: string): string {
  if (value === 'White Fulani') return 'White Fulani (Bunaji)';
  return BREEDS.includes(value) ? value : OTHER_BREED;
}

function displayBreed(cow: Pick<Cow, 'breed' | 'breedOther'>): string {
  return cow.breed === OTHER_BREED ? cow.breedOther || OTHER_BREED : cow.breed;
}

function cowLabel(cow: Pick<Cow, 'name' | 'cowId'>): string {
  return cow.name.trim() || cow.cowId.trim();
}

function modelFeedType(feedTypes: string[]): string {
  if (feedTypes.length === 0) return '';
  if (feedTypes.length > 1 && feedTypes.some((feed) => feed.startsWith('Grazing'))) return 'Grazing with supplement';
  if (feedTypes.length > 1) return 'Mixed ration';
  return feedTypes[0];
}

function translatedFactor(factor: string, copy: Copy): string {
  const factors: Record<string, string> = {
    'Early lactation was entered and may increase expected yield.': copy.factorEarly,
    'Later lactation was entered and may reduce expected yield.': copy.factorLate,
    'A lower body condition score may reduce expected yield.': copy.factorLowBody,
    'The entered body condition may support expected yield.': copy.factorHighBody,
    'More frequent milking may increase expected yield.': copy.factorMilking,
    'Mastitis was entered and may reduce expected yield.': copy.factorMastitis,
    'Pregnancy together with later lactation may reduce expected yield.': copy.factorPregnancy,
    'The estimate uses the cow information entered above.': copy.factorGeneral,
    'The selected breed curve was used.': copy.factorBreedCurve,
    'The number of previous calvings was used.': copy.factorParityCurve,
    'Days since calving set the point on the lactation curve.': copy.factorDaysCurve,
  };
  return factors[factor] || factor;
}

function feedbackLabel(feedback: string, copy: Copy): string {
  if (feedback === 'useful') return copy.useful;
  if (feedback === 'not_useful') return copy.notUseful;
  return copy.notSure;
}
