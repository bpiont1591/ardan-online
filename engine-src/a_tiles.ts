  const GRASS = 0, PATH = 1, WATER = 2, TREE = 3, WALL = 4, ROOF = 5, DOOR = 6, FLOOR = 7, CWALL = 8, BRIDGE = 9,
    FLOWER = 10, FENCE = 11, SAND = 12, ROCK = 13, PORTAL = 14, DGRASS = 15, WELL = 16, CRYSTAL = 17,
    MUD = 18, BOG = 19, REED = 20, DEADT = 21, COBBLE = 22, SWALL = 23, ROOF2 = 24, FOUNT = 25, SNOW = 26, ICE = 27,
    SPINE = 28, CLIFF = 29, DUNE = 30, CACTUS = 31, RUINW = 32, RFLOOR = 33, PILLAR = 34;
  const BLOCK: boolean[] = [];
  [WATER, TREE, WALL, ROOF, DOOR, CWALL, FENCE, ROCK, WELL, CRYSTAL, BOG, DEADT, SWALL, ROOF2, FOUNT, SPINE, CLIFF, CACTUS, RUINW, PILLAR].forEach((v: number) => { BLOCK[v] = true; });
  const TALL: boolean[] = [];
  [TREE, WALL, ROOF, DOOR, CWALL, CRYSTAL, DEADT, SWALL, ROOF2, SPINE, CLIFF, RUINW, PILLAR].forEach((v: number) => { TALL[v] = true; });
  const MINI: string[] = [];
  MINI[GRASS] = "#4b8d3b"; MINI[DGRASS] = "#3f7a33"; MINI[FLOWER] = "#5a9a45"; MINI[PATH] = "#c09a60"; MINI[SAND] = "#d6c07c";
  MINI[WATER] = "#2d6db0"; MINI[TREE] = "#1f4a1c"; MINI[WALL] = "#d9c39a"; MINI[ROOF] = "#a8432f"; MINI[DOOR] = "#5a3a1e";
  MINI[FLOOR] = "#5a5463"; MINI[CWALL] = "#1d1922"; MINI[BRIDGE] = "#8b5e34"; MINI[FENCE] = "#8a6238"; MINI[ROCK] = "#8a8a8a";
  MINI[PORTAL] = "#c58cff"; MINI[WELL] = "#8d8d95"; MINI[CRYSTAL] = "#5fe3ff";
  MINI[MUD] = "#615e3e"; MINI[BOG] = "#2c4636"; MINI[REED] = "#77803e"; MINI[DEADT] = "#2a261e"; MINI[COBBLE] = "#a19dab";
  MINI[SWALL] = "#4d4a58"; MINI[ROOF2] = "#3a5fa8"; MINI[FOUNT] = "#6ab0e8"; MINI[SNOW] = "#e8eef6"; MINI[ICE] = "#a8d8f0";
  MINI[SPINE] = "#2c5a48"; MINI[CLIFF] = "#6f7480"; MINI[DUNE] = "#cfa964"; MINI[CACTUS] = "#4f8a3a"; MINI[RUINW] = "#9a7448";
  MINI[RFLOOR] = "#cdb48a"; MINI[PILLAR] = "#efe2bc";
