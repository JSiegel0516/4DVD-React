const STOPS = [
  [68, 1, 84], [72, 35, 116], [64, 67, 135], [52, 94, 141], [41, 120, 142],
  [32, 144, 140], [34, 167, 132], [68, 190, 112], [121, 209, 81], [189, 223, 38]
];
const lerp = (a,b,t)=>a+(b-a)*t;

export const VIRIDIS = Array.from({length:256}, (_,i)=>{
  const x = i/255*(STOPS.length-1);
  const i0 = Math.floor(x), i1 = Math.min(STOPS.length-1, i0+1), t = x-i0;
  const c0 = STOPS[i0], c1 = STOPS[i1];
  return [
    Math.round(lerp(c0[0], c1[0], t)),
    Math.round(lerp(c0[1], c1[1], t)),
    Math.round(lerp(c0[2], c1[2], t)),
    255
  ];
});
