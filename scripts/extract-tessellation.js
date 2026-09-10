const fs = require('fs');
const code = fs.readFileSync('node_modules/@mediapipe/face_mesh/face_mesh.js', 'utf8');

const idx = code.indexOf('[[127,34]');
console.log('Index of [[127,34]:', idx);
if (idx !== -1) {
  let end = code.indexOf(']]', idx);
  console.log('Snippet:', code.substring(idx, end + 2).substring(0, 200));
  const tessArrayStr = code.substring(idx, end + 2);
  const content = `// MediaPipe 468 3D Landmark Facial Triangulation Mesh Connections
export const FACEMESH_TESSELATION: Array<[number, number]> = ${tessArrayStr};
`;
  fs.writeFileSync('src/lib/face-tessellation.ts', content);
  console.log('Successfully written src/lib/face-tessellation.ts!');
}
