// ---- Бібліотека вправ ----
// Спільна для сторінки тренувань і для AI-помічника (ai.js на сервері).
// Раніше жила всередині workout/app.js, і поки читала її одна сторінка —
// це нікому не заважало. Тепер помічник теж уміє записувати тренування, а
// значить має розпізнати «жим лежачи» й покласти в документ той самий
// libId, що й форма. Дві копії таблиці розійшлися б з першою ж доданою
// вправою, тож копія лишилась одна — ця.
//
// libId важливіший за назву: рекорди й статистика групуються саме за ним
// (див. exerciseKey у workout/app.js), тому вправа з бібліотеки лишається
// тією самою вправою навіть після зміни мови інтерфейсу.
(function (root) {
  'use strict';

  var EXERCISE_LIB = [
    { id: 'benchPress', muscle: 'chest' },
    { id: 'inclineDbPress', muscle: 'chest' },
    { id: 'chestFly', muscle: 'chest' },
    { id: 'barbellRow', muscle: 'back' },
    { id: 'pullUp', muscle: 'back' },
    { id: 'deadlift', muscle: 'back' },
    { id: 'squat', muscle: 'legs' },
    { id: 'legPress', muscle: 'legs' },
    { id: 'lunge', muscle: 'legs' },
    { id: 'overheadPress', muscle: 'shoulders' },
    { id: 'lateralRaise', muscle: 'shoulders' },
    { id: 'bicepCurl', muscle: 'arms' },
    { id: 'tricepExtension', muscle: 'arms' },
    { id: 'dip', muscle: 'arms' },
    { id: 'plank', muscle: 'core' },
    { id: 'crunch', muscle: 'core' },
  ];

  var MUSCLE_ORDER = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'];

  var EXERCISE_LABELS = {
    uk: {
      benchPress: 'Жим лежачи', inclineDbPress: 'Жим гантелей на похилій', chestFly: 'Розведення гантелей лежачи',
      barbellRow: 'Тяга штанги в нахилі', pullUp: 'Підтягування', deadlift: 'Станова тяга',
      squat: 'Присідання зі штангою', legPress: 'Жим ногами', lunge: 'Випади',
      overheadPress: 'Жим стоячи', lateralRaise: 'Розведення гантелей в сторони',
      bicepCurl: 'Підйом на біцепс', tricepExtension: 'Французький жим', dip: 'Віджимання на брусах',
      plank: 'Планка', crunch: 'Скручування',
    },
    ru: {
      benchPress: 'Жим лёжа', inclineDbPress: 'Жим гантелей на наклонной', chestFly: 'Разведение гантелей лёжа',
      barbellRow: 'Тяга штанги в наклоне', pullUp: 'Подтягивания', deadlift: 'Становая тяга',
      squat: 'Приседания со штангой', legPress: 'Жим ногами', lunge: 'Выпады',
      overheadPress: 'Жим стоя', lateralRaise: 'Разведение гантелей в стороны',
      bicepCurl: 'Подъём на бицепс', tricepExtension: 'Французский жим', dip: 'Отжимания на брусьях',
      plank: 'Планка', crunch: 'Скручивания',
    },
    pl: {
      benchPress: 'Wyciskanie leżąc', inclineDbPress: 'Wyciskanie hantli skos dodatni', chestFly: 'Rozpiętki z hantlami',
      barbellRow: 'Wiosłowanie sztangą', pullUp: 'Podciąganie', deadlift: 'Martwy ciąg',
      squat: 'Przysiad ze sztangą', legPress: 'Wyciskanie nogami', lunge: 'Wykroki',
      overheadPress: 'Wyciskanie nad głowę', lateralRaise: 'Unoszenie hantli bokiem',
      bicepCurl: 'Uginanie na biceps', tricepExtension: 'Francuskie wyciskanie', dip: 'Pompki na poręczach',
      plank: 'Deska', crunch: 'Brzuszki',
    },
    en: {
      benchPress: 'Bench Press', inclineDbPress: 'Incline DB Press', chestFly: 'DB Chest Fly',
      barbellRow: 'Barbell Row', pullUp: 'Pull-up', deadlift: 'Deadlift',
      squat: 'Barbell Squat', legPress: 'Leg Press', lunge: 'Lunges',
      overheadPress: 'Overhead Press', lateralRaise: 'Lateral Raise',
      bicepCurl: 'Bicep Curl', tricepExtension: 'Tricep Extension', dip: 'Dips',
      plank: 'Plank', crunch: 'Crunches',
    },
  };

  /** Назва вправи потрібною мовою. Невідомий id повертає сам id — краще
   *  показати «benchPress», ніж порожнечу на місці назви. */
  function exerciseLabel(libId, lang) {
    var dict = EXERCISE_LABELS[lang] || EXERCISE_LABELS.uk;
    return dict[libId] || libId || '';
  }

  /** М'язова група вправи з бібліотеки; null для власної вправи. */
  function exerciseMuscle(libId) {
    var found = EXERCISE_LIB.filter(function (e) { return e.id === libId; })[0];
    return found ? found.muscle : null;
  }

  var api = {
    EXERCISE_LIB: EXERCISE_LIB,
    MUSCLE_ORDER: MUSCLE_ORDER,
    EXERCISE_LABELS: EXERCISE_LABELS,
    exerciseLabel: exerciseLabel,
    exerciseMuscle: exerciseMuscle,
  };

  root.WorkoutExercises = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
