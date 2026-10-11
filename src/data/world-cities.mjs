// The real cities students can buy a plot in (baked by scripts/world-cities.mjs into public/world/<id>/).
// Plain JS so the bake script and the app read one list.

/** The square of each city that is baked, in metres a side, round its landmark. */
export const CITY_SIZE = 1200;

export const CITIES = [
  { id: "new-york", name: "New York", place: "Midtown, by Central Park", lat: 40.7616, lon: -73.9776, price: 600 },
  { id: "paris", name: "Paris", place: "The Eiffel Tower and the Seine", lat: 48.8584, lon: 2.2945, price: 500 },
  { id: "london", name: "London", place: "Westminster and the Thames", lat: 51.5007, lon: -0.1246, price: 500 },
  { id: "tokyo", name: "Tokyo", place: "Shibuya", lat: 35.6595, lon: 139.7005, price: 450 },
  { id: "rome", name: "Rome", place: "The Colosseum", lat: 41.8902, lon: 12.4922, price: 400 },
  { id: "rio", name: "Rio de Janeiro", place: "Copacabana", lat: -22.9711, lon: -43.1822, price: 350 },
];
