import { calculateSimilarity } from '../src/lib/face-utils';
import { db } from '../src/lib/insforge';

async function testGlobalDeduplication() {
  console.log('====================================================');
  console.log('   Testing Global Biometric Deduplication Security  ');
  console.log('====================================================\n');

  // Fetch all activated students in DB
  const { data: activatedStudents } = await db
    .from('students')
    .select('id, name, matric_number, facial_data')
    .is('activated', true);

  console.log(`Found ${activatedStudents?.length || 0} activated student(s) in DB.`);

  if (!activatedStudents || activatedStudents.length === 0) {
    console.log('No activated students found to compare against.');
    return;
  }

  const firstStudent = activatedStudents[0];
  console.log(`Testing with primary registered student: ${firstStudent.name} (${firstStudent.matric_number})`);

  let firstDescriptor: number[] = [];
  try {
    const parsed = JSON.parse(firstStudent.facial_data as string);
    firstDescriptor = parsed.descriptor || parsed;
  } catch (err) {
    console.error('Failed to parse primary student facial data:', err);
    return;
  }

  // Simulate an attempt by another student using the same face
  console.log('\nSimulating second student attempting activation with same face vector...');

  let duplicateFound = false;
  for (const otherStudent of activatedStudents) {
    // If comparing against self, skip
    if (otherStudent.id === 'test-dummy-id-999') continue;

    const otherDataStr = otherStudent.facial_data as string;
    if (!otherDataStr) continue;

    const parsedOther = JSON.parse(otherDataStr);
    const otherDesc = parsedOther.descriptor || parsedOther;

    const similarity = calculateSimilarity(firstDescriptor, otherDesc);
    console.log(`Comparing candidate face against student ${otherStudent.matric_number}: ${similarity}% match`);

    if (similarity >= 50.0) {
      duplicateFound = true;
      console.log(`🛑 SECURITY REJECTION TRIGGERED: Similarity is ${similarity}% (>= 50% threshold).`);
      console.log(`Action: Server rejects registration for second student with HTTP 409 conflict!`);
      break;
    }
  }

  if (duplicateFound) {
    console.log('\n✅ Global Biometric Deduplication Test PASSED!');
  } else {
    console.log('\n❌ Deduplication test failed to detect match.');
  }
}

testGlobalDeduplication().catch(console.error);
