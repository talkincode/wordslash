// Development utilities - generate sample data for testing
import { JsonlStorage } from '../storage/storage';
import { createCard, type Card } from '../storage/schema';

const SAMPLE_WORDS: Array<{
  term: string;
  phonetic: string;
  example: string;
  translation: string;
  explanation: string;
}> = [
  {
    term: 'ubiquitous',
    phonetic: '/juːˈbɪkwɪtəs/',
    example: 'Smartphones have become ubiquitous in modern society.',
    translation: '无处不在的',
    explanation: 'adj. present, appearing, or found everywhere',
  },
  {
    term: 'ephemeral',
    phonetic: '/ɪˈfemərəl/',
    example: 'The beauty of cherry blossoms is ephemeral.',
    translation: '短暂的，转瞬即逝的',
    explanation: 'adj. lasting for a very short time',
  },
  {
    term: 'pragmatic',
    phonetic: '/præɡˈmætɪk/',
    example: 'We need a pragmatic approach to solve this problem.',
    translation: '务实的，实用主义的',
    explanation: 'adj. dealing with things sensibly and realistically',
  },
  {
    term: 'serendipity',
    phonetic: '/ˌserənˈdɪpəti/',
    example: 'Finding that book was pure serendipity.',
    translation: '意外发现珍奇事物的运气',
    explanation: 'n. the occurrence of events by chance in a happy way',
  },
  {
    term: 'resilient',
    phonetic: '/rɪˈzɪliənt/',
    example: 'Children are often more resilient than adults think.',
    translation: '有弹性的，适应力强的',
    explanation: 'adj. able to recover quickly from difficulties',
  },
  {
    term: 'paradigm',
    phonetic: '/ˈpærədaɪm/',
    example: 'This discovery represents a paradigm shift in physics.',
    translation: '范式，典范',
    explanation: 'n. a typical example or pattern of something',
  },
  {
    term: 'verbose',
    phonetic: '/vɜːrˈboʊs/',
    example: 'His verbose explanations often confused the students.',
    translation: '冗长的，啰嗦的',
    explanation: 'adj. using more words than needed',
  },
  {
    term: 'succinct',
    phonetic: '/səkˈsɪŋkt/',
    example: 'Please keep your answers succinct.',
    translation: '简洁的，简明的',
    explanation: 'adj. briefly and clearly expressed',
  },
  {
    term: 'ambiguous',
    phonetic: '/æmˈbɪɡjuəs/',
    example: 'The contract language was ambiguous.',
    translation: '模棱两可的，含糊的',
    explanation: 'adj. open to more than one interpretation',
  },
  {
    term: 'compelling',
    phonetic: '/kəmˈpelɪŋ/',
    example: 'She made a compelling argument for the change.',
    translation: '引人注目的，令人信服的',
    explanation: 'adj. evoking interest or attention in a powerfully irresistible way',
  },
];

export async function generateSampleCards(storage: JsonlStorage): Promise<number> {
  let count = 0;

  for (const word of SAMPLE_WORDS) {
    const card: Card = createCard({
      type: 'word',
      front: {
        term: word.term,
        phonetic: word.phonetic,
        example: word.example,
        context: {
          langId: 'plaintext',
        },
      },
      back: {
        translation: word.translation,
        explanation: word.explanation,
      },
    });

    await storage.appendCard(card);
    count++;
  }

  return count;
}
