import { landmarksToDescriptor, calculateSimilarity } from '../src/lib/face-utils.ts';
import { isWithinVenueOrLecturer, calculateEffectiveDistance } from '../src/lib/geo.ts';

console.log('====================================================');
console.log('          checkIn Engine Verification Test          ');
console.log('====================================================');

// ----------------------------------------------------
// TEST 1: Biometrics Scale & Translation Invariance
// ----------------------------------------------------
console.log('\n--- 1. Biometrics Invariance Test ---');

// Synthesize 468 landmarks for Person A (Base Pose at 30cm)
const landmarksBase = [];
for (let i = 0; i < 468; i++) {
  landmarksBase.push({
    x: (i % 20) * 0.02 + 0.1,
    y: Math.floor(i / 20) * 0.02 + 0.1,
    z: Math.sin(i * 0.1) * 0.05,
  });
}
// Set landmark 33 (left outer eye) and 263 (right outer eye)
landmarksBase[33] = { x: 0.3, y: 0.4, z: 0 };
landmarksBase[263] = { x: 0.7, y: 0.4, z: 0 };
landmarksBase[168] = { x: 0.5, y: 0.4, z: 0 };

const descBase = landmarksToDescriptor(landmarksBase);

// Person A at 70cm (Shifted position + 2.5x scaled face size)
const landmarksShifted = [];
for (let i = 0; i < 468; i++) {
  landmarksShifted.push({
    x: (landmarksBase[i].x - 0.5) * 2.5 + 1.2,
    y: (landmarksBase[i].y - 0.4) * 2.5 + 0.8,
    z: (landmarksBase[i].z) * 2.5 + 0.3,
  });
}
landmarksShifted[33] = { x: (0.3 - 0.5) * 2.5 + 1.2, y: (0.4 - 0.4) * 2.5 + 0.8, z: 0.3 };
landmarksShifted[263] = { x: (0.7 - 0.5) * 2.5 + 1.2, y: (0.4 - 0.4) * 2.5 + 0.8, z: 0.3 };
landmarksShifted[168] = { x: 1.2, y: 0.8, z: 0.3 };

const descShifted = landmarksToDescriptor(landmarksShifted);

const sameFaceSimilarity = calculateSimilarity(descBase, descShifted);
console.log(`Same Person (different camera distance & offset): ${sameFaceSimilarity}% similarity`);

// Synthesize Person B (Different facial geometry)
const landmarksPersonB = [];
for (let i = 0; i < 468; i++) {
  landmarksPersonB.push({
    x: Math.cos(i * 0.2) * 0.15 + 0.5,
    y: Math.sin(i * 0.3) * 0.15 + 0.5,
    z: Math.cos(i * 0.1) * 0.08,
  });
}
landmarksPersonB[33] = { x: 0.35, y: 0.42, z: 0.01 };
landmarksPersonB[263] = { x: 0.65, y: 0.38, z: -0.01 };
landmarksPersonB[168] = { x: 0.5, y: 0.4, z: 0 };

const descPersonB = landmarksToDescriptor(landmarksPersonB);
const diffPersonSimilarity = calculateSimilarity(descBase, descPersonB);
console.log(`Different Person: ${diffPersonSimilarity}% similarity`);

if (sameFaceSimilarity > 90.0 && diffPersonSimilarity < 40.0) {
  console.log('✅ Biometrics Invariance Test PASSED!');
} else {
  console.error('❌ Biometrics Invariance Test FAILED!');
  process.exit(1);
}

// ----------------------------------------------------
// TEST 2: Geolocation Engine & Dual Anchor Validation
// ----------------------------------------------------
console.log('\n--- 2. Geolocation Engine Test ---');

// FUTA Akure coordinates
const studentLat = 7.3076;
const studentLng = 5.1395;
const studentAccuracy = 25.0; // 25 meters indoor uncertainty

const lecturerPos = { lat: 7.3082, lng: 5.1401 }; // ~90m raw distance away
const venuePos = { lat: 7.3078, lng: 5.1397 };   // ~30m raw distance away

const geoResult = isWithinVenueOrLecturer(
  studentLat,
  studentLng,
  studentAccuracy,
  lecturerPos,
  venuePos,
  50 // 50m threshold
);

console.log('Student indoor position:', { studentLat, studentLng, studentAccuracy });
console.log('Check result:', geoResult);

if (geoResult.within && geoResult.anchorUsed === 'venue') {
  console.log('✅ Geolocation Dual-Anchor Test PASSED!');
} else {
  console.error('❌ Geolocation Dual-Anchor Test FAILED!');
  process.exit(1);
}

console.log('\n====================================================');
console.log('         All Verification Tests Passed!             ');
console.log('====================================================');
