// A problem with a fact missing: first the story without it (what is missing?), then the whole
// story, solved (Ε΄ Επαναληπτικό 2, 3ο πρόβλημα: «Πόσα € θα πληρώσει μια οικογένεια με τρία
// παιδιά;», where the number of adults is not given).
import { extra, fmt, known, NO_MISTAKE, NOTHING_FORGOTTEN, people, sought, type Builder, type Draft, type Family, type Person, type Rng, type Wording } from '../../lib.ts';
import type { ProblemStep } from '../../../../shared/types.ts';

const ASK = 'Μπορούμε να λύσουμε αυτό το πρόβλημα; Τι λείπει;';
const ASK_HINT = 'Σκέψου τι πράξεις θα κάναμε. Για ποια από αυτές δεν έχουμε τον αριθμό;';
const TAG_HINT = 'Τώρα η ιστορία έχει ό,τι χρειαζόμαστε. Ό,τι δεν αλλάζει την απάντηση το αφήνουμε.';
const WORDS: Record<number, string> = { 1: 'ένα', 2: 'δύο', 3: 'τρία', 4: 'τέσσερα' };

type Scenario = (r: Rng, b: Builder, p: Person) => Draft | null;

// Theatre tickets for a family "with three children"
const theatre: Scenario = (r, b, p) => {
  const adult = r.int(12, 20), off = r.int(2, 6);
  const child = adult - off;
  const named = r.chance(0.5);
  // Told as "a family with 2 parents and 3 children" (the adults are missing), or as
  // "Nikos, his mother and his 2 siblings" (the siblings are missing)
  const adults = named ? 1 : r.int(1, 2);
  const sib = r.int(2, 3);
  const kids = named ? sib + 1 : r.int(2, 4);
  const total = kids * child + adults * adult;
  const price = `${known(`το εισιτήριο κοστίζει ${adult} € για τους ενήλικες`)} και ${known(`${off} € λιγότερα για τα παιδιά`)}`;
  let told: string, story: string, right: string, wrong: Wording[];
  if (!named) {
    told = `Σε μια θεατρική παράσταση το εισιτήριο κοστίζει ${adult} € για τους ενήλικες και ${off} € λιγότερα για τα παιδιά. Πόσα € θα πληρώσει μια οικογένεια με ${WORDS[kids]} παιδιά;`;
    story = `Σε μια θεατρική παράσταση, ${extra(`που κρατάει ${r.step(70, 110, 5)} λεπτά`)}, ${price}. ${sought('Πόσα € θα πληρώσει μια οικογένεια')} ${known(`με ${adults} ${adults === 1 ? 'ενήλικα' : 'γονείς'} και ${kids} παιδιά`)};`;
    right = 'Πόσοι ενήλικες είναι στην οικογένεια';
    wrong = [['Πόσο κοστίζει το παιδικό εισιτήριο', 'Πόσο κοστίζει το εισιτήριο του παιδιού'], ['Πόσα παιδιά έχει η οικογένεια', 'Πόσα είναι τα παιδιά'], ['Πόσο κρατάει η παράσταση', 'Πόσα λεπτά κρατάει η παράσταση']];
  } else {
    told = `${p.Nom}, η μητέρα ${p.his} και τα αδέρφια ${p.his} πάνε στο θέατρο. Το εισιτήριο κοστίζει ${adult} € για τους ενήλικες και ${off} € λιγότερα για τα παιδιά. Πόσα € θα πληρώσουν όλοι μαζί;`;
    story = `${known(`${p.Nom}, η μητέρα ${p.his} και τα ${sib} αδέρφια ${p.his}`)} πάνε στο θέατρο. ${price.replace(/^\[(.)/, (_m, c) => `[${c.toUpperCase()}`)}. ${extra(`Η παράσταση αρχίζει στις ${r.int(6, 9)} το βράδυ`)}. ${sought('Πόσα € θα πληρώσουν όλοι μαζί')};`;
    right = `Πόσα αδέρφια έχει ${p.nom}`;
    wrong = [['Πόσοι ενήλικες πάνε στο θέατρο', 'Πόσοι ενήλικες πάνε'], ['Πόσο κοστίζει το παιδικό εισιτήριο', 'Πόσο κοστίζει το εισιτήριο του παιδιού'], ['Τι ώρα αρχίζει η παράσταση', 'Τι ώρα αρχίζει']];
  }
  const steps: ProblemStep[] = [
    b.choice('read', ASK, right, wrong,
      'Το εισιτήριο των παιδιών το βρίσκουμε από των ενηλίκων. Ποιον αριθμό δεν μπορούμε να βρούμε με κανέναν τρόπο;', told),
    b.tag(undefined, TAG_HINT),
    b.numbers('solve', 'Λύνουμε.', [
      ...(named ? [{ label: 'Πόσα παιδιά είναι', answer: kids }] : []),
      { label: r.chance(0.5) ? `Ένα παιδικό εισιτήριο: ${adult} − ${off} =` : 'Ένα παιδικό εισιτήριο', answer: child, unit: '€' },
      { label: r.chance(0.5) ? `Τα παιδιά: ${kids} × ${child} =` : 'Τα εισιτήρια των παιδιών', answer: kids * child, unit: '€' },
      { label: adults === 2 ? `Οι γονείς: 2 × ${adult} =` : named ? 'Το εισιτήριο της μητέρας' : 'Το εισιτήριο του ενήλικα', answer: adults * adult, unit: '€' },
      { label: 'Όλοι μαζί', answer: total, unit: '€' },
    ], named ? `Τα παιδιά είναι τα ${sib} αδέρφια και ${p.female ? 'η ίδια' : 'ο ίδιος'} ${p.nom}.` : `Το παιδικό εισιτήριο κοστίζει ${off} € λιγότερα από τα ${adult} €.`),
    named && r.chance(0.5)
      ? b.choice('check', `Κάποιος απάντησε «${fmt(total - child)} €». Τι ξέχασε;`, `Το εισιτήριο ${p.gen}`,
        [NOTHING_FORGOTTEN, ['Το εισιτήριο της μητέρας', 'Τη μητέρα', 'Το εισιτήριο της μαμάς τους']], `Τα παιδιά είναι ${kids}, όχι ${sib}.`)
      : b.choice('check', `Κάποιος απάντησε «${fmt((kids + adults) * adult)} €». Τι έκανε λάθος;`,
        'Πλήρωσε τα παιδιά σαν ενήλικες',
        [NO_MISTAKE, ['Ξέχασε να πληρώσει για έναν ενήλικα', 'Ξέχασε έναν ενήλικα', 'Δεν πλήρωσε για έναν ενήλικα']],
        'Τα παιδιά έχουν φθηνότερο εισιτήριο.'),
  ];
  return { title: 'Το εισιτήριο του θεάτρου', story, steps };
};

// Buses for a school trip, with the pupils missing
const buses: Scenario = (r, b) => {
  const pupils = r.int(150, 290), teachers = r.int(8, 16), seats = r.pick([45, 48, 50, 52, 55]);
  const all = pupils + teachers;
  const full = Math.floor(all / seats), rest = all % seats;
  if (rest === 0) return null;
  const hours = r.int(6, 10);
  const told = `Ένα σχολείο πηγαίνει εκδρομή με λεωφορεία των ${seats} θέσεων. Μαζί με τα παιδιά θα πάνε και ${teachers} εκπαιδευτικοί. Πόσα λεωφορεία χρειάζονται;`;
  const story = r.chance(0.5)
    ? `Ένα σχολείο πηγαίνει εκδρομή με ${known(`λεωφορεία των ${seats} θέσεων`)}. Θα πάνε ${known(`${pupils} μαθητές`)} και ${known(`${teachers} εκπαιδευτικοί`)}. ${extra(`Η εκδρομή θα κρατήσει ${hours} ώρες`)}. ${sought('Πόσα λεωφορεία χρειάζονται')};`
    : `${sought('Πόσα λεωφορεία χρειάζονται')} για την εκδρομή ενός σχολείου, αν θα πάνε ${known(`${pupils} μαθητές`)} και ${known(`${teachers} εκπαιδευτικοί`)} και ${known(`κάθε λεωφορείο έχει ${seats} θέσεις`)}; Θα ξεκινήσουν ${extra(`στις ${r.int(7, 8)} το πρωί`)}.`;
  const steps: ProblemStep[] = [
    b.choice('read', ASK, 'Πόσοι μαθητές θα πάνε',
      [['Πόσες θέσεις έχει κάθε λεωφορείο', 'Πόσες θέσεις έχει ένα λεωφορείο'], ['Πόσο κοστίζει ένα λεωφορείο', 'Πόσο κοστίζει ένα λεωφορείο για τη μέρα'], ['Πού θα πάνε εκδρομή', 'Πού θα πάνε']],
      ASK_HINT, told),
    b.tag(undefined, TAG_HINT),
    b.numbers('solve', 'Λύνουμε.', [
      { label: r.chance(0.5) ? `Όλοι μαζί: ${pupils} + ${teachers} =` : 'Όλοι μαζί', answer: all, unit: 'άτομα' },
      { label: `Γεμάτα λεωφορεία: το πηλίκο της διαίρεσης ${all} : ${seats}`, answer: full },
      { label: 'Άτομα που περισσεύουν: το υπόλοιπο', answer: rest },
      { label: 'Λεωφορεία που χρειάζονται', answer: full + 1 },
    ], `Διαίρεση με υπόλοιπο: ${all} = ${full} × ${seats} + ${rest}. Και όσοι περισσεύουν χρειάζονται θέση.`),
    b.choice('check', `Κάποιος απάντησε «${full}». Τι ξέχασε;`, `Ένα λεωφορείο ακόμα για τα ${rest}`,
      [NOTHING_FORGOTTEN, ['Να αφαιρέσει τους εκπαιδευτικούς', 'Τους εκπαιδευτικούς', 'Να βγάλει τους εκπαιδευτικούς']],
      'Κανείς δεν μένει πίσω από την εκδρομή.'),
  ];
  return { title: 'Τα λεωφορεία της εκδρομής', story, steps };
};

// Chocolates into boxes, with the size of the box missing
const boxes: Scenario = (r, b) => {
  const d1 = r.int(320, 790), d2 = r.int(280, 690), per = r.pick([12, 16, 18, 20, 24, 25, 30]);
  const all = d1 + d2;
  const full = Math.floor(all / per), rest = all % per;
  if (rest === 0) return null;
  const told = `Ένα εργαστήριο ζαχαροπλαστικής έφτιαξε τη μια ημέρα ${d1} σοκολατάκια και την άλλη ${d2}. Θέλει να τα συσκευάσει όλα σε κουτιά. Πόσα κουτιά θα χρειαστεί;`;
  const story = r.chance(0.5)
    ? `Ένα εργαστήριο ζαχαροπλαστικής, ${extra(`με ${r.int(3, 7)} ζαχαροπλάστες`)}, έφτιαξε ${known(`τη μια ημέρα ${d1} σοκολατάκια`)} και ${known(`την άλλη ${d2}`)}. Θέλει να τα συσκευάσει όλα σε κουτιά που ${known(`καθένα χωράει ${per} σοκολατάκια`)}. ${sought('Πόσα κουτιά θα χρειαστεί')};`
    : `${known(`Κάθε κουτί χωράει ${per} σοκολατάκια`)}. Ένα εργαστήριο ζαχαροπλαστικής έφτιαξε ${known(`${d1} σοκολατάκια τη Δευτέρα`)} και ${known(`${d2} την Τρίτη`)}, και θέλει να τα συσκευάσει όλα. ${extra(`Κάθε κουτί κοστίζει ${r.int(1, 4)} €`)}. ${sought('Πόσα κουτιά θα χρειαστεί')};`;
  const steps: ProblemStep[] = [
    b.choice('read', ASK, 'Πόσα σοκολατάκια χωράει κάθε κουτί',
      [['Πόσα σοκολατάκια έφτιαξε τη δεύτερη ημέρα', 'Πόσα έφτιαξε τη δεύτερη ημέρα'], ['Πόσο κοστίζει κάθε κουτί στο μαγαζί', 'Πόσο κοστίζει κάθε κουτί'], ['Πόσοι ζαχαροπλάστες δουλεύουν εκεί', 'Πόσοι ζαχαροπλάστες δουλεύουν']],
      ASK_HINT, told),
    b.tag(undefined, TAG_HINT),
    b.numbers('solve', 'Λύνουμε.', [
      { label: r.chance(0.5) ? `Όλα τα σοκολατάκια: ${d1} + ${d2} =` : 'Όλα τα σοκολατάκια', answer: all },
      { label: `Γεμάτα κουτιά: το πηλίκο της διαίρεσης ${fmt(all)} : ${per}`, answer: full },
      { label: 'Σοκολατάκια που περισσεύουν: το υπόλοιπο', answer: rest },
      { label: 'Κουτιά που χρειάζονται', answer: full + 1 },
    ], `Διαίρεση με υπόλοιπο: ${fmt(all)} = ${full} × ${per} + ${rest}. Και όσα περισσεύουν θέλουν κουτί.`),
    b.numbers('check', 'Πώς ελέγχουμε; Τα γεμάτα κουτιά και όσα περισσεύουν πρέπει να κάνουν όλα τα σοκολατάκια.', [
      { label: `${full} × ${per} + ${rest} =`, answer: all },
    ]),
  ];
  return { title: 'Τα κουτιά με τα σοκολατάκια', story, steps };
};

// Change after shopping, with one price missing
const change: Scenario = (r, b, p) => {
  const n = r.int(2, 5), each = r.int(6, 18), bag = r.int(20, 45), paid = r.pick([100, 150, 200]);
  const cost = n * each + bag;
  if (cost >= paid) return null;
  const books = `${n} βιβλία των ${each} €`;
  const told = `${p.Nom} αγοράζει ${books} και ένα σακίδιο για το σχολείο. Πληρώνει με ${paid} €. Πόσα ρέστα θα πάρει;`;
  const story = r.chance(0.5)
    ? `${p.Nom} αγοράζει ${known(books)} και ${known(`ένα σακίδιο των ${bag} €`)} για το σχολείο. ${extra(`Το βιβλιοπωλείο είναι ${r.int(2, 6)} στενά από το σπίτι ${p.his}`)}. ${known(`Πληρώνει με ${paid} €`)}. ${sought('Πόσα ρέστα θα πάρει')};`
    : `Για τη νέα σχολική χρονιά, ${p.nom} διαλέγει ${known(books)} και ${known(`ένα σακίδιο που κοστίζει ${bag} €`)}. ${extra(`Στο ταμείο περιμένουν ${r.int(3, 8)} πελάτες`)}. ${known(`Δίνει ${paid} €`)}. ${sought('Πόσα ρέστα θα πάρει')};`;
  const steps: ProblemStep[] = [
    b.choice('read', ASK, 'Πόσο κοστίζει το σακίδιο',
      [['Πόσο κοστίζει κάθε βιβλίο', 'Πόσο κοστίζει κάθε βιβλίο της λίστας'], ['Πόσα βιβλία αγοράζει', 'Πόσα βιβλία αγοράζει συνολικά'], ['Τι χρώμα είναι το σακίδιο', 'Τι χρώμα είναι']],
      ASK_HINT, told),
    b.tag(undefined, TAG_HINT),
    b.numbers('solve', 'Λύνουμε.', [
      { label: r.chance(0.5) ? `Τα βιβλία: ${n} × ${each} =` : 'Τα βιβλία', answer: n * each, unit: '€' },
      { label: 'Όλα μαζί', answer: cost, unit: '€' },
      { label: r.chance(0.5) ? `Ρέστα: ${paid} − ${cost} =` : 'Ρέστα', answer: paid - cost, unit: '€' },
    ], `Τα βιβλία είναι ${n}, των ${each} € το καθένα.`),
    b.numbers('check', 'Πώς ελέγχουμε; Όσα πλήρωσε για όλα και τα ρέστα κάνουν όσα έδωσε.', [
      { label: `${cost} + ${paid - cost} =`, answer: paid, unit: '€' },
    ]),
  ];
  return { title: 'Τα ρέστα', story, steps };
};

// Pizzas for a class party, with the slices of a pizza missing
const pizza: Scenario = (r, b) => {
  const kids = r.int(18, 28), each = r.int(2, 3), slices = r.pick([6, 8]);
  const all = kids * each;
  const full = Math.floor(all / slices), rest = all % slices;
  const need = full + (rest ? 1 : 0);
  const told = `Στο πάρτι της τάξης είναι ${kids} παιδιά. Κάθε παιδί θα φάει ${each} κομμάτια πίτσα. Πόσες πίτσες πρέπει να παραγγείλουν;`;
  const story = r.chance(0.5)
    ? `Στο πάρτι της τάξης, ${extra(`που αρχίζει στις ${r.int(5, 7)} το απόγευμα`)}, είναι ${known(`${kids} παιδιά`)}. ${known(`Κάθε παιδί θα φάει ${each} κομμάτια πίτσα`)} και ${known(`κάθε πίτσα κόβεται σε ${slices} κομμάτια`)}. ${sought('Πόσες πίτσες πρέπει να παραγγείλουν')};`
    : `${known(`Κάθε πίτσα κόβεται σε ${slices} κομμάτια`)}. ${sought('Πόσες πίτσες χρειάζονται')} για ${known(`${kids} παιδιά`)}, αν ${known(`το καθένα τρώει ${each} κομμάτια`)}; ${extra(`Κάθε πίτσα κοστίζει ${r.int(9, 14)} €`)}.`;
  const steps: ProblemStep[] = [
    b.choice('read', ASK, 'Πόσα κομμάτια έχει κάθε πίτσα',
      [['Πόσα παιδιά είναι στο πάρτι', 'Πόσα παιδιά είναι'], ['Πόσα κομμάτια τρώει κάθε παιδί', 'Πόσα κομμάτια τρώει κάθε παιδί στο πάρτι'], ['Τι ώρα αρχίζει το πάρτι', 'Τι ώρα αρχίζει']],
      ASK_HINT, told),
    b.tag(undefined, TAG_HINT),
    b.numbers('solve', 'Λύνουμε.', [
      { label: r.chance(0.5) ? `Όλα τα κομμάτια: ${kids} × ${each} =` : 'Όλα τα κομμάτια', answer: all },
      { label: `Γεμάτες πίτσες: το πηλίκο της διαίρεσης ${all} : ${slices}`, answer: full },
      { label: 'Κομμάτια που περισσεύουν: το υπόλοιπο', answer: rest },
      { label: 'Πίτσες που χρειάζονται', answer: need },
    ], rest ? `${all} = ${full} × ${slices} + ${rest}. Για τα κομμάτια που περισσεύουν χρειάζεται μία πίτσα ακόμα.` : `${all} = ${full} × ${slices}: δεν περισσεύει κανένα κομμάτι.`),
    rest
      ? b.choice('check', `Κάποιος απάντησε «${full}». Τι ξέχασε;`, `Μία πίτσα ακόμα για ${rest} κομμάτια`,
        [NOTHING_FORGOTTEN, ['Να προσθέσει και τη δασκάλα στο πάρτι', 'Τη δασκάλα', 'Να μετρήσει και τη δασκάλα']], 'Αν παραγγείλουν μόνο τόσες, κάποια παιδιά δεν θα φάνε όσα κομμάτια πρέπει.')
      : b.numbers('check', 'Πώς ελέγχουμε;', [{ label: `${need} × ${slices} =`, answer: all }], 'Όλα τα κομμάτια των πιτσών πρέπει να φτάνουν για όλα τα παιδιά.'),
  ];
  return { title: 'Οι πίτσες του πάρτι', story, steps };
};

// Cinema for "Fotis and his 3 friends", with the ticket price missing
const cinema: Scenario = (r, b, p) => {
  const friends = r.int(2, 5), ticket = r.int(6, 9), pop = r.int(3, 5);
  const n = friends + 1;
  const told = `${p.Nom} και ${friends} φίλοι ${p.his} πάνε σινεμά. Αγοράζουν ο καθένας ένα ποπ κορν των ${pop} € και ένα εισιτήριο. Πόσα € πληρώνουν όλοι μαζί;`;
  const story = r.chance(0.5)
    ? `${known(`${p.Nom} και ${friends} φίλοι ${p.his}`)} πάνε σινεμά, ${extra(`σε μια ταινία ${r.step(90, 130, 5)} λεπτών`)}. ${known(`Αγοράζουν ο καθένας ένα εισιτήριο των ${ticket} €`)} και ${known(`ένα ποπ κορν των ${pop} €`)}. ${sought('Πόσα € πληρώνουν όλοι μαζί')};`
    : `${known(`Το εισιτήριο του σινεμά κοστίζει ${ticket} €`)} και ${known(`το ποπ κορν ${pop} €`)}. ${known(`${p.Nom} και ${friends} φίλοι ${p.his}`)} ${known('παίρνουν ο καθένας από ένα εισιτήριο και ένα ποπ κορν')}. ${extra(`Η αίθουσα έχει ${r.int(8, 15) * 10} θέσεις`)}. ${sought('Πόσα € πληρώνουν όλοι μαζί')};`;
  const steps: ProblemStep[] = [
    b.choice('read', ASK, 'Πόσο κοστίζει το εισιτήριο',
      [['Πόσα παιδιά πάνε σινεμά', 'Πόσα παιδιά πάνε'], ['Πόσο κοστίζει το ποπ κορν', 'Πόσο κοστίζει ένα ποπ κορν στο σινεμά'], ['Τι ταινία θα δουν στο σινεμά', 'Τι ταινία θα δουν']],
      ASK_HINT, told),
    b.tag(undefined, TAG_HINT),
    b.numbers('solve', 'Λύνουμε.', [
      { label: 'Πόσα παιδιά είναι', answer: n },
      { label: r.chance(0.5) ? `Για ένα παιδί: ${ticket} + ${pop} =` : 'Για ένα παιδί', answer: ticket + pop, unit: '€' },
      { label: 'Όλοι μαζί', answer: n * (ticket + pop), unit: '€' },
    ], `Μην ξεχάσεις και ${p.female ? 'την ίδια' : 'τον ίδιο'} ${p.acc}: ${friends} φίλοι και ${p.female ? 'η ίδια' : 'ο ίδιος'}.`),
    b.choice('check', `Κάποιος απάντησε «${fmt(friends * (ticket + pop))} €». Τι ξέχασε;`, `Να μετρήσει και ${p.acc}`,
      [NOTHING_FORGOTTEN, ['Να μετρήσει και το ποπ κορν', 'Το ποπ κορν', 'Να υπολογίσει και το ποπ κορν']],
      `Τα παιδιά είναι ${n}, όχι ${friends}.`),
  ];
  return { title: 'Στο σινεμά', story, steps };
};

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export const missingInfo: Family = {
  id: 'missing-info',
  grade: 5,
  unit: 2,
  source: 'Μαθηματικά Ε΄, Επαναληπτικό 2, 3ο πρόβλημα (η οικογένεια με τρία παιδιά) και 1ο πρόβλημα',
  make(r, b) {
    const [p] = people(r, 1);
    return r.pick([theatre, buses, boxes, change, pizza, cinema])(r, b, p);
  },
};
