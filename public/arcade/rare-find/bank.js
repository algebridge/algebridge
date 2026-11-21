// Rare Find: the hand-written bank of many-right-answer prompts. Pure logic, no DOM, so node can test it.
// Rarity here is OUR OWN written ranking of how obvious each answer is (C common, U uncommon, R rare,
// V very rare). It is never player data.
//
// Spec format, one line per tier:   C: Answer=alias=alias, Next answer
//   "City_Nickname" shows as "City Nickname" and also accepts the nickname alone.
//   A trailing "!" on an answer turns off the automatic surname alias (only used with { sur: true }).

export const TIER_POINTS = [20, 50, 75, 100];
export const CATS = {
  people: "Great minds",
  science: "Discoveries",
  space: "Space",
  elements: "Periodic table",
  geo: "Geography",
  animals: "Animals",
  sports: "Sports",
  games: "Games and hobbies",
  arts: "Music and art",
  words: "Math words",
};

const DEFS = [];
const add = (cat, text, spec, opt = {}) => DEFS.push({ cat, text, spec, ...opt });

// ---------------- people of math and science ----------------
add("people", "Name a famous mathematician", `
C: Pythagoras, Isaac Newton, Euclid, Archimedes
U: Carl Friedrich Gauss=Karl Gauss, Leonhard Euler, Rene Descartes, Blaise Pascal, Leonardo Fibonacci=Leonardo of Pisa, Alan Turing, Ada Lovelace, Katherine Johnson, Pierre de Fermat, Gottfried Leibniz=Gottfried Wilhelm Leibniz=Leibnitz, Galileo Galilei=Galileo
R: Bernhard Riemann, Srinivasa Ramanujan, Emmy Noether, Hypatia, Al-Khwarizmi=Khwarizmi=Muhammad ibn Musa al-Khwarizmi, John von Neumann=von Neumann, Kurt Godel=Goedel, David Hilbert, Henri Poincare, Georg Cantor, John Nash, Thales=Thales of Miletus, Sophie Germain, George Boole, Joseph-Louis Lagrange=Lagrange, Pierre-Simon Laplace=Laplace, Evariste Galois, John Napier, Johannes Kepler, Terence Tao=Terry Tao, Andrew Wiles, Maryam Mirzakhani, Bertrand Russell, Benoit Mandelbrot, Thomas Bayes, John Venn, Grace Hopper, Dorothy Vaughan, Ptolemy=Claudius Ptolemy, Eratosthenes, Jacob Bernoulli=Johann Bernoulli=Daniel Bernoulli, Joseph Fourier, Claude Shannon
V: Augustin-Louis Cauchy=Cauchy, Brahmagupta, Aryabhata, Omar Khayyam, Diophantus, Paul Erdos, Niels Henrik Abel=Niels Abel, Sofia Kovalevskaya=Sofya Kovalevskaya, Grigori Perelman, John Conway=John Horton Conway, Benjamin Banneker, Liu Hui, Zu Chongzhi, Bhaskara=Bhaskara II, Gerolamo Cardano=Girolamo Cardano, Adrien-Marie Legendre=Legendre, Carl Jacobi, Peter Dirichlet=Dirichlet, Karl Weierstrass, Richard Dedekind, G. H. Hardy=Godfrey Hardy, Andrey Kolmogorov, Alexander Grothendieck, William Rowan Hamilton, Augustus De Morgan=De Morgan, August Mobius=Moebius, Felix Klein, Nikolai Lobachevsky, Pafnuty Chebyshev, Andrey Markov, Christiaan Huygens`, { sur: true });

add("people", "Name a scientist who won a Nobel Prize in Physics", `
C: Albert Einstein, Marie Curie=Curie=Madame Curie=Marie Sklodowska Curie
U: Niels Bohr=Bohr, Richard Feynman, Max Planck, Pierre Curie, Werner Heisenberg, Erwin Schrodinger=Schroedinger
R: Wilhelm Rontgen=Roentgen=Wilhelm Conrad Rontgen, Enrico Fermi, Paul Dirac, Guglielmo Marconi, Peter Higgs, Max Born, J. J. Thomson=Joseph John Thomson=JJ Thomson, Henri Becquerel, Louis de Broglie=de Broglie, Wolfgang Pauli, Robert Millikan, James Chadwick, Roger Penrose, Kip Thorne, Donna Strickland, Andrea Ghez, C. V. Raman=Chandrasekhara Venkata Raman, Subrahmanyan Chandrasekhar, Albert Michelson, Hendrik Lorentz, Murray Gell-Mann, Maria Goeppert Mayer=Goeppert Mayer=Maria Mayer, Steven Weinberg, Abdus Salam, Geoffrey Hinton, John Bardeen, William Shockley
V: Lev Landau, Arthur Compton, Hideki Yukawa, Ernest Lawrence, Charles Townes, Hans Bethe, Eugene Wigner, Luis Alvarez, Frank Wilczek, Gerard 't Hooft=Gerard t Hooft=Hooft, Saul Perlmutter, Adam Riess, Brian Schmidt, Rainer Weiss, Barry Barish, Andre Geim, Konstantin Novoselov, Arno Penzias, Pyotr Kapitsa=Peter Kapitza=Kapitza, Carl Anderson, Victor Hess, Otto Stern, Isidor Rabi, William Lawrence Bragg=Lawrence Bragg=William Henry Bragg=William Bragg, Anne L'Huillier, John Hopfield, Reinhard Genzel, Syukuro Manabe, Giorgio Parisi, Klaus Hasselmann, Alain Aspect, John Clauser, Anton Zeilinger, Arthur Ashkin, Gerard Mourou, Jim Peebles=James Peebles, Michel Mayor, Didier Queloz, Takaaki Kajita, Arthur McDonald, Francois Englert, Serge Haroche, David Wineland, Pierre Agostini, Ferenc Krausz, Max von Laue=von Laue, Chen Ning Yang=C N Yang=Yang Chen-Ning, Tsung-Dao Lee=T D Lee, Samuel Ting, Steven Chu, Carl Wieman, Eric Cornell, Wolfgang Ketterle, Sheldon Glashow, Julian Schwinger, Shinichiro Tomonaga=Sin-Itiro Tomonaga, Dennis Gabor, Edward Purcell, Felix Bloch, Pieter Zeeman, Lord Rayleigh=Rayleigh=John William Strutt, Walter Brattain, Shuji Nakamura, Isamu Akasaki, Hiroshi Amano, Charles Kao, Yoichiro Nambu, David Gross, David Politzer, Martinus Veltman, Aage Bohr`, { sur: true });

add("people", "Name a scientist an SI unit is named after", `
C: Isaac Newton, Nikola Tesla, James Watt, Anders Celsius
U: Lord Kelvin=Kelvin=William Thomson, Alessandro Volta=Volt, Andre-Marie Ampere=Ampere=Amp, Georg Ohm=Georg Simon Ohm, James Prescott Joule=James Joule, Blaise Pascal, Heinrich Hertz, Michael Faraday=Farad
R: Charles-Augustin de Coulomb=Charles Coulomb=Coulomb, Henri Becquerel, Joseph Henry, Wilhelm Weber
V: Werner von Siemens=Ernst Werner von Siemens, Louis Harold Gray=Louis Gray=Hal Gray, Rolf Sievert=Rolf Maximilian Sievert`, { sur: true });

add("people", "Name a person who has walked on the Moon", `
C: Neil Armstrong
U: Buzz Aldrin=Edwin Aldrin
R: Alan Shepard, Eugene Cernan=Gene Cernan
V: Pete Conrad=Charles Conrad, Alan Bean, Edgar Mitchell=Ed Mitchell, David Scott=Dave Scott, James Irwin=Jim Irwin, John Young, Charles Duke=Charlie Duke, Harrison Schmitt=Jack Schmitt`, { sur: true });

// ---------------- discoveries and science ----------------
add("science", "Name one of the six simple machines", `
C: Lever, Pulley
U: Wheel and axle=Wheel=Axle, Inclined plane=Ramp
R: Screw
V: Wedge`);

add("science", "Name a kind of wave on the electromagnetic spectrum", `
C: Visible light=Light=Visible, X-rays=X ray=Xray
U: Microwaves=Microwave, Radio waves=Radio=Radio wave, Ultraviolet=UV=Ultraviolet light=UV light
R: Infrared=IR=Infrared light
V: Gamma rays=Gamma=Gamma ray=Gamma radiation`);

add("science", "Name one of the four fundamental forces of nature", `
C: Gravity=Gravitation=Gravitational force=Gravitational
U: Electromagnetism=Electromagnetic force=Electromagnetic=Electromagnetic interaction
R: Strong nuclear force=Strong force=Strong=Strong nuclear=Strong interaction
V: Weak nuclear force=Weak force=Weak=Weak nuclear=Weak interaction`);

add("science", "Name one of the four bases of DNA", `
C: Adenine=A
U: Thymine=T
R: Guanine=G, Cytosine=C`);

add("science", "Name a state of matter", `
C: Solid, Liquid, Gas
R: Plasma
V: Bose-Einstein condensate=BEC=Bose Einstein=Condensate`);

add("science", "Name a subatomic particle", `
C: Electron, Proton, Neutron
U: Quark=Up quark=Down quark=Charm quark=Strange quark=Top quark=Bottom quark, Photon
R: Neutrino, Positron=Antielectron, Higgs boson=Higgs=Higgs particle, Muon, Gluon
V: Tau=Tau particle=Tauon, W boson=W, Z boson=Z, Pion=Pi meson, Kaon, Meson, Lepton, Boson, Hadron, Baryon, Fermion, Antiproton, Antineutron`);

add("science", "Name a vitamin by its letter", `
C: Vitamin C=C, Vitamin D=D=D3
U: Vitamin A=A, Vitamin B=B=B1=B2=B3=B5=B6=B7=B9=B12
R: Vitamin E=E
V: Vitamin K=K=K2`);

add("science", "Name one of the five senses", `
C: Sight=Vision=Seeing=See, Hearing=Sound=Hear
U: Taste=Tasting, Smell=Smelling
R: Touch=Feeling=Touching=Feel`);

add("science", "Name a layer of Earth's atmosphere", `
C: Stratosphere, Troposphere
U: Mesosphere
R: Thermosphere, Exosphere
V: Ionosphere`);

add("science", "Name a layer of the Earth", `
C: Crust, Core
U: Mantle
R: Inner core, Outer core
V: Lithosphere, Asthenosphere`);

add("science", "Name one of the Seven Wonders of the Ancient World", `
C: Great Pyramid of Giza=Great Pyramid=Pyramid of Giza=Pyramids of Giza=Pyramid=Pyramids=Giza
U: Hanging Gardens of Babylon=Hanging Gardens, Colossus of Rhodes=Colossus
R: Lighthouse of Alexandria=Lighthouse=Pharos=Pharos of Alexandria, Statue of Zeus at Olympia=Statue of Zeus=Zeus
V: Temple of Artemis at Ephesus=Temple of Artemis=Artemis, Mausoleum at Halicarnassus=Mausoleum=Mausoleum of Halicarnassus=Halicarnassus`);

add("science", "Name one of the seven SI base units", `
C: Meter=Metre=M, Second=S=Sec
U: Kilogram=Kg=Kilo
R: Kelvin=K, Ampere=Amp=A
V: Mole=Mol, Candela=Cd`);

// ---------------- space ----------------
add("space", "Name a planet in our solar system", `
C: Earth, Mars
U: Jupiter, Saturn, Venus
R: Mercury, Neptune
V: Uranus`);

add("space", "Name a dwarf planet recognized by astronomers", `
C: Pluto
R: Ceres, Eris
V: Haumea, Makemake`);

add("space", "Name a planet in our solar system that has rings", `
C: Saturn
R: Jupiter, Uranus
V: Neptune`);

add("space", "Name a moon of Jupiter or Saturn", `
C: Europa, Titan
U: Io, Ganymede, Enceladus
R: Callisto, Mimas, Rhea, Iapetus, Dione, Tethys
V: Amalthea, Himalia, Thebe, Metis, Adrastea, Elara, Pasiphae, Sinope, Carme, Ananke, Leda, Lysithea, Hyperion, Phoebe, Janus, Epimetheus, Pandora, Prometheus, Atlas, Pan, Daphnis, Helene, Telesto, Calypso`);

add("space", "Name one of the 88 official constellations", `
C: Orion, Ursa Major=Big Dipper=Great Bear=Big Bear, Leo, Gemini
U: Ursa Minor=Little Dipper=Little Bear, Cassiopeia, Taurus, Scorpius=Scorpio, Aries, Virgo, Cancer, Libra, Pisces, Aquarius, Sagittarius, Capricornus=Capricorn, Andromeda, Pegasus, Draco, Hercules
R: Cygnus, Lyra, Canis Major, Canis Minor, Perseus, Crux=Southern Cross, Centaurus, Hydra, Aquila, Phoenix, Cepheus, Bootes, Ophiuchus, Cetus, Auriga, Corona Borealis, Lynx, Monoceros, Delphinus, Eridanus, Carina, Serpens, Triangulum, Lepus, Lupus, Corvus
V: Antlia, Apus, Ara, Caelum, Camelopardalis, Canes Venatici, Chamaeleon, Circinus, Columba, Coma Berenices, Corona Australis, Crater, Dorado, Equuleus, Fornax, Grus, Horologium, Hydrus, Indus, Lacerta, Leo Minor, Mensa, Microscopium, Musca, Norma, Octans, Pavo, Pictor, Piscis Austrinus, Puppis, Pyxis, Reticulum, Sagitta, Sculptor, Scutum, Sextans, Telescopium, Triangulum Australe, Tucana, Vela, Volans, Vulpecula`);

add("space", "Name a phase of the Moon", `
C: Full moon=Full, New moon=New, Crescent=Crescent moon
U: First quarter=First quarter moon=Half moon=Quarter moon=Quarter, Waxing crescent, Gibbous=Gibbous moon
R: Waning crescent, Last quarter=Third quarter=Last quarter moon=Third quarter moon, Waxing gibbous
V: Waning gibbous`);

add("space", "Name a NASA space shuttle orbiter", `
C: Challenger, Columbia
U: Discovery, Atlantis
R: Endeavour=Endeavor
V: Enterprise`);

// ---------------- periodic table ----------------
add("elements", "Name any chemical element", `
C: Hydrogen, Oxygen, Gold, Carbon, Iron, Helium, Silver
U: Nitrogen, Sodium, Calcium, Copper, Neon, Aluminum=Aluminium, Zinc, Lead, Mercury=Quicksilver, Uranium, Potassium, Chlorine, Silicon, Tin, Nickel, Magnesium, Lithium, Sulfur=Sulphur, Platinum, Titanium, Argon, Fluorine, Phosphorus, Iodine, Plutonium
R: Boron, Beryllium, Chromium, Cobalt, Manganese, Arsenic, Krypton, Xenon, Radon, Radium, Tungsten=Wolfram, Barium, Bromine, Cesium=Caesium, Bismuth, Polonium, Einsteinium, Gallium, Germanium, Selenium, Strontium, Zirconium, Palladium, Cadmium, Iridium, Francium, Thorium, Americium, Curium, Californium, Scandium, Vanadium, Antimony, Osmium, Neodymium, Rubidium
V: Yttrium, Niobium, Molybdenum, Technetium, Ruthenium, Rhodium, Indium, Tellurium, Lanthanum, Cerium, Praseodymium, Promethium, Samarium, Europium, Gadolinium, Terbium, Dysprosium, Holmium, Erbium, Thulium, Ytterbium, Lutetium, Hafnium, Tantalum, Rhenium, Thallium, Astatine, Actinium, Protactinium, Neptunium, Berkelium, Fermium, Mendelevium, Nobelium, Lawrencium, Rutherfordium, Dubnium, Seaborgium, Bohrium, Hassium, Meitnerium, Darmstadtium, Roentgenium, Copernicium, Nihonium, Flerovium, Moscovium, Livermorium, Tennessine, Oganesson`);

add("elements", "Name a noble gas", `
C: Helium, Neon
U: Argon
R: Krypton, Xenon
V: Radon, Oganesson`);

add("elements", "Name an alkali metal", `
C: Sodium
U: Lithium, Potassium
R: Cesium=Caesium
V: Rubidium, Francium`);

add("elements", "Name a halogen", `
C: Chlorine
U: Fluorine, Iodine
R: Bromine
V: Astatine, Tennessine`);

add("elements", "Name an element whose symbol is just one letter", `
C: Hydrogen=H, Oxygen=O, Carbon=C
U: Nitrogen=N, Potassium=K, Uranium=U, Sulfur=Sulphur=S
R: Fluorine=F, Phosphorus=P, Iodine=I, Boron=B
V: Tungsten=Wolfram=W, Vanadium=V, Yttrium=Y`);

add("elements", "Name an element that is a gas at room temperature", `
C: Oxygen, Hydrogen, Helium
U: Nitrogen, Neon
R: Chlorine, Argon, Fluorine
V: Krypton, Xenon, Radon`);

// ---------------- geography ----------------
add("geo", "Name a country in Africa", `
C: Egypt, South Africa, Nigeria, Kenya
U: Morocco, Ethiopia, Ghana, Madagascar, Uganda, Algeria, Sudan, Somalia, Zimbabwe, Tanzania, Libya, Democratic Republic of the Congo=DR Congo=DRC=Democratic Republic of Congo=Congo Kinshasa, Rwanda, Senegal, Tunisia, Cameroon, Chad, Angola, Mali
R: Niger, Zambia, Botswana, Namibia, Mozambique, Ivory Coast=Cote d'Ivoire, Liberia, Sierra Leone, South Sudan, Malawi, Republic of the Congo=Congo=Republic of Congo=Congo Brazzaville, Gabon, Togo, Benin, Burkina Faso, Guinea, Mauritius, Seychelles, Gambia, Eritrea
V: Burundi, Cabo Verde=Cape Verde, Central African Republic=CAR, Comoros, Djibouti, Equatorial Guinea, Eswatini=Swaziland, Guinea-Bissau, Lesotho, Mauritania, Sao Tome and Principe=Sao Tome`);

add("geo", "Name a US state", `
C: California, Texas, Florida, New York, Hawaii, Alaska
U: Washington, Colorado, Arizona, Georgia, Ohio, Michigan, Illinois, Pennsylvania, New Jersey, Virginia, Nevada, Oregon, Massachusetts, North Carolina, Tennessee, Utah, Louisiana, Maryland
R: Alabama, Arkansas, Connecticut, Idaho, Indiana, Iowa, Kansas, Kentucky, Maine, Minnesota, Mississippi, Missouri, Montana, Oklahoma, South Carolina, Wisconsin, New Mexico, Vermont, West Virginia, Wyoming
V: Delaware, Nebraska, New Hampshire, North Dakota, Rhode Island, South Dakota`);

add("geo", "Name a country in South America", `
C: Brazil, Argentina
U: Peru, Chile, Colombia, Venezuela
R: Ecuador, Bolivia, Uruguay, Paraguay
V: Guyana, Suriname`);

add("geo", "Name the capital city of a South American country", `
C: Lima, Buenos Aires
U: Brasilia, Santiago, Bogota, Caracas
R: Quito, Montevideo, La Paz
V: Asuncion, Sucre, Georgetown, Paramaribo`);

add("geo", "Name the capital city of a country in Europe", `
C: London, Paris, Rome
U: Berlin, Madrid, Athens, Moscow, Dublin, Amsterdam, Vienna, Lisbon
R: Stockholm, Oslo, Copenhagen, Brussels, Warsaw, Prague, Budapest, Helsinki, Kyiv=Kiev, Bern=Berne, Reykjavik, Vatican City=Vatican
V: Tirana, Andorra la Vella, Minsk, Sarajevo, Sofia, Zagreb, Tallinn, Riga, Vaduz, Vilnius, Luxembourg=Luxembourg City, Valletta, Chisinau, Monaco, Podgorica, Skopje, Bucharest, San Marino, Belgrade, Bratislava, Ljubljana, Nicosia, Pristina`);

add("geo", "Name one of the world's five oceans", `
C: Pacific, Atlantic
U: Indian
R: Arctic
V: Southern=Antarctic`, { drop: ["ocean"] });

add("geo", "Name a continent", `
C: Asia, Africa, Europe, North America
U: South America, Australia=Oceania=Australasia
R: Antarctica`);

add("geo", "Name one of the five Great Lakes", `
C: Michigan, Superior
U: Erie
R: Ontario
V: Huron`, { drop: ["lake"] });

add("geo", "Name a US state the Mississippi River touches", `
C: Mississippi, Louisiana
U: Minnesota, Missouri, Tennessee
R: Illinois, Arkansas, Iowa
V: Wisconsin, Kentucky`);

add("geo", "Name a country the Danube River touches", `
C: Germany, Austria
U: Hungary
R: Romania, Serbia, Bulgaria, Slovakia
V: Croatia, Ukraine, Moldova`);

add("geo", "Name a country in Central America", `
C: Costa Rica, Panama
U: Guatemala, Honduras
R: Nicaragua, El Salvador
V: Belize`);

add("geo", "Name a country whose name ends in stan", `
C: Pakistan, Afghanistan
U: Kazakhstan
R: Uzbekistan
V: Turkmenistan, Tajikistan, Kyrgyzstan`);

add("geo", "Name one of the original 13 American colonies", `
C: Virginia, Massachusetts, New York
U: Pennsylvania, Georgia, Maryland, New Jersey, Delaware
R: North Carolina, South Carolina, Connecticut
V: Rhode Island, New Hampshire`);

// ---------------- animals ----------------
add("animals", "Name one of the five big cats in the genus Panthera", `
C: Lion, Tiger
U: Leopard
R: Jaguar
V: Snow leopard`);

add("animals", "Name a species of bear", `
C: Polar bear=Polar, Giant panda=Panda=Panda bear, Brown bear=Grizzly bear=Grizzly=Kodiak bear=Brown
U: American black bear=Black bear=Black
R: Sun bear=Sun
V: Sloth bear=Sloth, Spectacled bear=Andean bear=Spectacled, Asian black bear=Asiatic black bear=Moon bear`);

add("animals", "Name a great ape", `
C: Gorilla
U: Chimpanzee=Chimp, Orangutan=Orangutang
R: Bonobo
V: Human=Humans=People=Homo sapiens=Person`);

add("animals", "Name one of the five classes of vertebrates", `
C: Mammals=Mammal, Birds=Bird, Fish=Fishes
U: Reptiles=Reptile
R: Amphibians=Amphibian`);

add("animals", "Name an animal in the Chinese zodiac", `
C: Dragon, Tiger, Dog
U: Rat=Mouse, Monkey, Snake, Horse, Pig=Boar, Rabbit=Hare
R: Ox=Cow=Bull=Buffalo, Rooster=Chicken
V: Goat=Sheep=Ram`);

add("animals", "Name a bird that cannot fly", `
C: Penguin, Ostrich
U: Emu, Kiwi
R: Dodo, Cassowary
V: Rhea, Kakapo, Takahe, Weka, Moa, Flightless cormorant=Galapagos cormorant, Steamer duck, Great auk, Elephant bird`);

add("animals", "Name one of Africa's Big Five animals", `
C: Lion, Elephant=African elephant
U: Rhinoceros=Rhino=Black rhino=White rhino
R: Leopard
V: Cape buffalo=Buffalo=African buffalo`);

// ---------------- sports ----------------
add("sports", "Name an NBA team", `
C: Los Angeles_Lakers=LA Lakers, Golden State_Warriors=Golden State=GSW, Boston_Celtics=Boston, Chicago_Bulls=Chicago
U: New York_Knicks=New York=Knickerbockers, Miami_Heat=Miami, Brooklyn_Nets=Brooklyn, Philadelphia_76ers=Sixers=Philadelphia=Philly, Dallas_Mavericks=Mavs=Dallas, Milwaukee_Bucks=Milwaukee, Phoenix_Suns=Phoenix, San Antonio_Spurs=San Antonio, LA_Clippers=Los Angeles Clippers, Denver_Nuggets=Denver, Oklahoma City_Thunder=OKC=Oklahoma City, Cleveland_Cavaliers=Cavs=Cleveland, Houston_Rockets=Houston
R: Toronto_Raptors=Toronto, Atlanta_Hawks=Atlanta, Sacramento_Kings=Sacramento, Orlando_Magic=Orlando, Utah_Jazz=Utah, Detroit_Pistons=Detroit, Minnesota_Timberwolves=Wolves=Twolves=Minnesota, Portland_Trail Blazers=Blazers=Portland=Trailblazers, Washington_Wizards=Washington
V: Charlotte_Hornets=Charlotte, Indiana_Pacers=Indiana, New Orleans_Pelicans=New Orleans, Memphis_Grizzlies=Memphis`);

add("sports", "Name an NFL team", `
C: Dallas_Cowboys=Dallas, Kansas City_Chiefs=Kansas City=KC, New England_Patriots=Pats=New England, Philadelphia_Eagles=Philadelphia=Philly, Green Bay_Packers=Green Bay
U: San Francisco_49ers=Niners=San Francisco, Pittsburgh_Steelers=Pittsburgh, New York_Giants, New York_Jets, Chicago_Bears=Chicago, Las Vegas_Raiders=Las Vegas, Denver_Broncos=Denver, Seattle_Seahawks=Seattle, Miami_Dolphins=Miami, Baltimore_Ravens=Baltimore, Buffalo_Bills=Buffalo, Los Angeles_Rams=LA Rams, Minnesota_Vikings=Minnesota, Detroit_Lions=Detroit, New Orleans_Saints=New Orleans, Tampa Bay_Buccaneers=Bucs=Tampa Bay=Tampa, Cincinnati_Bengals=Cincinnati
R: Cleveland_Browns=Cleveland, Atlanta_Falcons=Atlanta, Carolina_Panthers=Carolina, Los Angeles_Chargers=LA Chargers, Arizona_Cardinals=Arizona, Indianapolis_Colts=Indianapolis, Washington_Commanders=Washington, Houston_Texans=Houston
V: Tennessee_Titans=Tennessee, Jacksonville_Jaguars=Jags=Jacksonville`);

add("sports", "Name a position in basketball", `
C: Center=Centre, Guard, Forward
U: Point guard=PG=Point
R: Shooting guard=SG, Small forward=SF
V: Power forward=PF`);

add("sports", "Name a position on a baseball field", `
C: Pitcher, Catcher
U: First base=First baseman=1B=First, Shortstop=Short stop=SS
R: Second base=Second baseman=2B=Second, Third base=Third baseman=3B=Third, Center field=Center fielder=Centerfield=CF
V: Left field=Left fielder=LF, Right field=Right fielder=RF, Designated hitter=DH`);

add("sports", "Name a sport from the 2024 Summer Olympics", `
C: Swimming=Marathon swimming=Open water swimming, Athletics=Track and field=Track=Running=Sprinting=Marathon=Hurdles=Long jump=High jump=Pole vault=Javelin=Shot put=Discus=Decathlon=Heptathlon=Triple jump=Hammer throw=Relay=Race walking, Gymnastics=Artistic gymnastics, Basketball=3x3 basketball, Soccer=Football
U: Tennis, Volleyball, Boxing, Diving, Cycling=BMX=Mountain biking=Track cycling=Road cycling=Biking, Golf, Wrestling, Skateboarding=Skateboard, Surfing
R: Archery, Badminton, Fencing, Judo, Rowing, Table tennis=Ping pong, Taekwondo, Weightlifting=Weight lifting, Water polo, Beach volleyball, Field hockey=Hockey, Rugby sevens=Rugby=Rugby 7s, Sailing, Shooting, Equestrian=Horse riding=Dressage=Show jumping=Eventing=Horseback riding, Triathlon, Breaking=Breakdancing=Break dancing, Sport climbing=Climbing=Rock climbing
V: Handball, Canoeing=Canoe=Kayaking=Kayak=Canoe slalom=Canoe sprint, Modern pentathlon=Pentathlon, Artistic swimming=Synchronized swimming=Synchronised swimming, Rhythmic gymnastics, Trampoline=Trampolining=Trampoline gymnastics`);

add("sports", "Name a Winter Olympic sport", `
C: Ice hockey=Hockey, Figure skating=Ice skating=Skating, Snowboarding=Snowboard, Alpine skiing=Skiing=Downhill skiing=Downhill=Slalom
U: Bobsled=Bobsleigh=Bobsledding, Curling, Speed skating, Ski jumping=Ski jump
R: Luge, Skeleton, Biathlon, Cross-country skiing=Cross country, Freestyle skiing=Moguls=Aerials
V: Nordic combined, Short track speed skating=Short track, Ski mountaineering=Skimo`);

add("sports", "Name one of the four Grand Slam tennis tournaments", `
C: Wimbledon
U: US Open=United States Open
R: French Open=Roland Garros
V: Australian Open`);

add("sports", "Name one of the four swimming strokes raced at the Olympics", `
C: Freestyle=Front crawl=Crawl=Free
U: Backstroke=Back, Butterfly=Fly
R: Breaststroke=Breast stroke=Breast`);

// ---------------- games and hobbies ----------------
add("games", "Name a chess piece", `
C: King, Queen
U: Knight=Horse, Pawn
R: Bishop
V: Rook=Castle=Tower`);

add("games", "Name a suit in a deck of playing cards", `
C: Hearts=Heart
U: Spades=Spade, Diamonds=Diamond
R: Clubs=Club=Clovers=Clover`);

add("games", "Name a color on a classic 3 by 3 puzzle cube", `
C: Red, Blue
U: Green, Yellow, White
R: Orange`);

add("games", "Name a classic board game", `
C: Monopoly, Chess, Checkers=Draughts
U: Scrabble, Clue=Cluedo, Sorry, Candy Land=Candyland, Life=Game of Life, Battleship, Connect Four=Connect 4, Risk, Trouble
R: Chutes and Ladders=Snakes and Ladders, Operation, Catan=Settlers of Catan, Backgammon, Guess Who, Trivial Pursuit, Mouse Trap=Mousetrap, Go, Pictionary, Ticket to Ride, Stratego, Parcheesi=Parchisi, Chinese checkers
V: Othello=Reversi, Mancala, Ludo, Pandemic, Carcassonne, Mastermind, Cranium, Scattergories, Taboo, Boggle, Yahtzee, Blokus, Qwirkle, Sequence, Rummikub, Mahjong, Shogi, Dominoes=Domino, Tic-tac-toe=Noughts and crosses, Azul, Aggravation, Hungry Hungry Hippos, Perfection, Payday, Upwords, Balderdash, Twister, Jenga, Kerplunk, Dominion, Splendor, Wingspan, Codenames, Axis and Allies, Diplomacy, Senet, Nine men's morris`);

add("games", "Name a musical instrument", `
C: Piano, Guitar=Acoustic guitar=Electric guitar, Drums=Drum=Drum set=Drum kit, Violin=Fiddle
U: Flute, Trumpet, Saxophone=Sax=Alto sax=Tenor sax=Alto saxophone=Tenor saxophone, Clarinet, Cello=Violoncello, Bass guitar=Bass=Electric bass, Ukulele=Uke, Trombone, Harp, Tuba, Keyboard, Recorder, Harmonica, Banjo, Xylophone, Tambourine
R: Viola, Oboe, Double bass=Upright bass=Contrabass=String bass, French horn=Horn, Piccolo, Organ=Pipe organ, Accordion, Mandolin, Bagpipes=Bagpipe, Triangle, Cymbals=Cymbal, Bongos=Bongo=Bongo drums, Maracas=Maraca, Snare drum=Snare, Bass drum, Timpani=Kettledrum=Kettle drums, Synthesizer=Synth, Bassoon, Kazoo, Cowbell
V: English horn=Cor anglais, Euphonium, Cornet, Flugelhorn, Sousaphone, Bugle, Sitar, Harpsichord, Marimba, Vibraphone, Glockenspiel, Didgeridoo, Theremin, Lute, Zither, Dulcimer, Ocarina, Pan flute=Panpipes=Pan pipes, Kalimba=Thumb piano=Mbira, Djembe, Congas=Conga, Steel drum=Steelpan=Steel pan=Steel drums, Tabla, Erhu, Koto, Shamisen, Balalaika, Castanets, Gong, Lyre, Bass clarinet, Contrabassoon, Mellophone, Baritone horn=Baritone, Melodica, Clavichord, Celesta, Guiro, Fife, Bouzouki, Oud, Cajon, Chimes=Tubular bells, Bells=Bell=Handbells, Whistle=Tin whistle=Penny whistle, Washboard, Hurdy-gurdy, Autoharp, Concertina, Vuvuzela`);

// ---------------- music and art ----------------
add("arts", "Name a color of the rainbow", `
C: Red, Blue
U: Yellow, Green, Orange
R: Violet=Purple
V: Indigo`);

add("arts", "Name a note of the solfege scale", `
C: Do=Doh
U: Re, Mi
R: Fa, Sol=So, La
V: Ti=Si`, { hint: "The scale that singers learn by syllables." });

add("arts", "Name a famous classical composer", `
C: Wolfgang Amadeus Mozart, Ludwig van Beethoven, Johann Sebastian Bach=J S Bach
U: Frederic Chopin, Pyotr Ilyich Tchaikovsky=Peter Tchaikovsky=Tchaikovski=Pyotr Tchaikovsky, Antonio Vivaldi, George Frideric Handel=Haendel=George Handel, Joseph Haydn=Franz Joseph Haydn, Franz Schubert, Johannes Brahms, Claude Debussy
R: Richard Wagner, Franz Liszt, Felix Mendelssohn=Mendelssohn, Robert Schumann=Schumann, Giuseppe Verdi, Giacomo Puccini, Igor Stravinsky, Gustav Mahler, Sergei Rachmaninoff=Rachmaninov, Antonin Dvorak, Maurice Ravel, Johann Strauss=Richard Strauss=Johann Strauss II, Edvard Grieg, Gioachino Rossini, Gustav Holst, Aaron Copland, George Gershwin, Niccolo Paganini, Leonard Bernstein, Johann Pachelbel
V: Erik Satie, Sergei Prokofiev, Dmitri Shostakovich, Jean Sibelius, Hector Berlioz, Georges Bizet, Edward Elgar, Modest Mussorgsky, Nikolai Rimsky-Korsakov=Rimsky Korsakov, Camille Saint-Saens=Saint Saens, Bela Bartok, Benjamin Britten, Claudio Monteverdi, Henry Purcell, Georg Philipp Telemann, Domenico Scarlatti, Clara Schumann, Hildegard of Bingen=Hildegard=Hildegard von Bingen, Philip Glass, Samuel Barber, Ralph Vaughan Williams!=Vaughan Williams, Gabriel Faure, Jacques Offenbach, Florence Price, Fanny Mendelssohn, Carl Orff, Arnold Schoenberg=Schonberg, Charles Ives, Anton Bruckner, Bedrich Smetana, Alexander Borodin, Tomaso Albinoni, Arcangelo Corelli, Jean-Baptiste Lully, Christoph Gluck=Christoph Willibald Gluck, Carl Maria von Weber, Gaetano Donizetti, Vincenzo Bellini, Olivier Messiaen, John Cage, Steve Reich, Arvo Part`, { sur: true });

add("arts", "Name a famous painter", `
C: Leonardo da Vinci=da Vinci=Leonardo, Vincent van Gogh=van Gogh, Pablo Picasso
U: Michelangelo, Claude Monet, Salvador Dali, Frida Kahlo, Rembrandt=Rembrandt van Rijn, Andy Warhol
R: Raphael, Johannes Vermeer=Jan Vermeer, Henri Matisse, Pierre-Auguste Renoir=Auguste Renoir, Paul Cezanne, Edouard Manet, Edgar Degas, Paul Gauguin, Gustav Klimt, Edvard Munch, Georgia O'Keeffe=O Keefe=OKeefe, Jackson Pollock, Sandro Botticelli, Bob Ross, Jean-Michel Basquiat, Diego Rivera, Norman Rockwell, Francisco Goya, Wassily Kandinsky, Katsushika Hokusai
V: Caravaggio, Diego Velazquez, El Greco, Titian, Peter Paul Rubens, Jan van Eyck=van Eyck, Hieronymus Bosch, Pieter Bruegel=Brueghel=Pieter Bruegel the Elder, Albrecht Durer=Duerer, J. M. W. Turner=William Turner, John Constable, Rene Magritte, Joan Miro, Marc Chagall, Piet Mondrian, Georges Seurat, Henri de Toulouse-Lautrec=Lautrec=Toulouse Lautrec, Mark Rothko, Edward Hopper, Keith Haring, Roy Lichtenstein, Mary Cassatt, Artemisia Gentileschi, Grant Wood, Winslow Homer, Paul Klee, Camille Pissarro, Eugene Delacroix, Jacques-Louis David, Giotto, Henri Rousseau, Egon Schiele, Yayoi Kusama, Jacob Lawrence, Kehinde Wiley`, { sur: true });

add("arts", "Name a singing voice type", `
C: Soprano
U: Alto, Tenor, Bass
R: Baritone
V: Mezzo-soprano=Mezzo, Contralto, Countertenor=Counter tenor`);

add("arts", "Name a section of an orchestra", `
C: Strings=String
U: Brass, Percussion
R: Woodwinds=Woodwind=Winds=Wind`);

// ---------------- math words ----------------
add("words", "Name a type of triangle", `
C: Right=Right angled=Right angle, Equilateral=Equiangular
U: Isosceles
R: Scalene, Acute
V: Obtuse`, { drop: ["triangle", "triangles"] });

add("words", "Name a quadrilateral", `
C: Square, Rectangle
U: Rhombus=Diamond, Trapezoid=Trapezium, Parallelogram
R: Kite
V: Isosceles trapezoid`);

add("words", "Name a unit of length", `
C: Inch=In, Foot=Feet=Ft, Mile=Mi, Meter=Metre=M
U: Yard=Yd, Centimeter=Centimetre=Cm, Kilometer=Kilometre=Km, Millimeter=Millimetre=Mm
R: Light-year=Lightyear, Nautical mile, Nanometer=Nanometre=Nm, Micrometer=Micrometre=Micron, Decimeter=Decimetre=Dm, Furlong, Fathom, League
V: Parsec, Astronomical unit=AU, Angstrom, Cubit, Rod, Chain, Hand, Decameter=Dekameter=Decametre, Hectometer=Hectometre, Picometer=Picometre, Mil=Thou, Light-second, Megameter=Megametre, Span, Pace`);

add("words", "Name a polygon by its number of sides, from 3 to 12", `
C: Triangle, Pentagon, Octagon
U: Hexagon, Quadrilateral=Square=Rectangle=Rhombus=Trapezoid=Parallelogram=Kite=Quadrangle=Tetragon
R: Decagon, Heptagon=Septagon
V: Nonagon=Enneagon, Hendecagon=Undecagon, Dodecagon`);

add("words", "Name a 3D shape", `
C: Cube, Sphere=Ball
U: Cone, Cylinder, Pyramid=Square pyramid=Triangular pyramid
R: Prism=Rectangular prism=Triangular prism=Cuboid=Hexagonal prism, Hemisphere, Tetrahedron
V: Octahedron, Dodecahedron, Icosahedron, Torus=Donut=Doughnut, Ellipsoid, Frustum`);

add("words", "Name one of the five Platonic solids", `
C: Cube=Hexahedron
U: Tetrahedron
R: Octahedron, Dodecahedron
V: Icosahedron`);

add("words", "Name a type of angle", `
C: Right, Acute
U: Obtuse
R: Straight, Complementary, Supplementary, Vertical
V: Reflex, Full=Complete=Full rotation, Adjacent, Corresponding, Alternate interior, Alternate exterior, Central, Inscribed, Interior, Exterior`, { drop: ["angle", "angles"] });

add("words", "Name a measure of center or spread in statistics", `
C: Mean=Average
U: Median, Mode
R: Range
V: Standard deviation, Interquartile range=IQR, Variance, Mean absolute deviation=MAD, Midrange`);

add("words", "Name a metric prefix", `
C: Kilo, Centi, Milli
U: Mega, Giga
R: Micro, Nano, Tera, Deci
V: Deka=Deca, Hecto, Pico, Femto, Atto, Peta, Exa, Zetta, Yotta, Zepto, Yocto, Ronna, Quetta, Ronto, Quecto`);

add("words", "Name a unit of time", `
C: Second, Minute, Hour
U: Day, Week, Month, Year
R: Decade, Century, Millisecond
V: Millennium, Fortnight, Nanosecond, Microsecond, Picosecond`);

add("words", "Name a part of a circle or a line drawn on one", `
C: Radius, Diameter
U: Circumference, Center=Centre
R: Arc, Chord
V: Sector, Segment, Tangent, Secant, Semicircle`);

add("words", "Name a Greek letter", `
C: Pi, Alpha
U: Beta, Delta, Omega, Theta, Sigma, Gamma
R: Lambda, Epsilon, Phi, Mu, Tau
V: Zeta, Eta, Iota, Kappa, Nu, Xi, Omicron, Rho, Upsilon, Chi, Psi`);

add("words", "Name a conic section", `
C: Circle
U: Parabola
R: Ellipse
V: Hyperbola`);

add("words", "Name a trigonometric function", `
C: Sine=Sin, Cosine=Cos
U: Tangent=Tan
R: Secant=Sec
V: Cosecant=Csc, Cotangent=Cot`);

add("words", "Name a letter used in Roman numerals", `
C: I, X
U: V
R: C, M
V: L, D`);

add("words", "Name a month that has 31 days", `
C: January, December
U: July, March, May, August
R: October`);

// ---------------- reading answers ----------------
/** Lowercase, accents and punctuation stripped, a leading "the" removed. Returns words joined by one space. */
export function clean(s) {
  return String(s)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^(the|a|an) (?=.)/, "");
}
/** The matching key: clean words, optional dropped words removed, then squeezed together. */
export function keyOf(s, drop) {
  let words = clean(s).split(" ").filter(Boolean);
  if (drop?.length) {
    const kept = words.filter((w) => !drop.includes(w));
    if (kept.length) words = kept;
  }
  return words.join("");
}
/** True when a and b are one typo apart: one letter added, dropped, changed, or two neighbors swapped. */
export function oneTypo(a, b) {
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1 || a === b) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
  }
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

const TIER_LETTERS = "CURV";
const slug = (s) => clean(s).replace(/ /g, "-");

/** Turns one definition into { id, cat, text, answers: [{ name, tier, keys }], index: Map(key -> answer) }. */
export function build(def) {
  const answers = [];
  const index = new Map();
  const problems = [];
  const claim = (key, ans, what) => {
    if (!key) { problems.push(`empty key for "${what}"`); return; }
    const had = index.get(key);
    if (had && had !== ans) { problems.push(`"${what}" collides with "${had.name}"`); return; }
    index.set(key, ans);
    if (!ans.keys.includes(key)) ans.keys.push(key);
  };
  for (const line of def.spec.split("\n")) {
    const m = /^\s*([CURV]):\s*(.+)$/.exec(line);
    if (!m) { if (line.trim()) problems.push(`unreadable line "${line.trim()}"`); continue; }
    const tier = TIER_LETTERS.indexOf(m[1]);
    for (const chunk of m[2].split(",")) {
      const parts = chunk.split("=").map((s) => s.trim()).filter(Boolean);
      if (!parts.length) continue;
      let first = parts[0], noSur = false;
      if (first.endsWith("!")) { noSur = true; first = first.slice(0, -1); }
      const name = first.replace(/_/g, " ");
      const ans = { name, tier, keys: [], aliases: [name, ...parts.slice(1)], noSur, nick: first.includes("_") ? first.split("_")[1] : null };
      answers.push(ans);
    }
  }
  // explicit names and aliases first, then the automatic ones only where they are free
  for (const a of answers) for (const al of a.aliases) claim(keyOf(al, def.drop), a, al);
  for (const a of answers) {
    if (a.nick) claim(keyOf(a.nick, def.drop), a, a.nick);
  }
  if (def.sur) {
    const count = new Map();
    const sur = (a) => keyOf(a.name.split(/\s+/).pop(), def.drop);
    for (const a of answers) if (!a.noSur) count.set(sur(a), (count.get(sur(a)) || 0) + 1);
    for (const a of answers) {
      const k = sur(a);
      if (a.noSur || k.length < 3 || count.get(k) > 1 || index.has(k)) continue;
      claim(k, a, k);
    }
  }
  return { id: slug(def.text), cat: def.cat, text: def.text, hint: def.hint || "", drop: def.drop || null, answers, index, problems };
}

/** Finds the listed answer for what the player typed. Returns { answer, via } or null. */
export function match(prompt, input) {
  const key = keyOf(input, prompt.drop);
  if (!key) return null;
  let a = prompt.index.get(key);
  if (a) return { answer: a, via: "exact" };
  for (const cut of [/s$/, /es$/]) {
    const k = key.replace(cut, "");
    if (k !== key && k.length >= 3 && (a = prompt.index.get(k))) return { answer: a, via: "plural" };
  }
  if (key.length >= 6 && !/\d/.test(key)) {
    const hits = new Set();
    for (const [k, ans] of prompt.index) if (k.length >= 6 && oneTypo(key, k)) hits.add(ans);
    if (hits.size === 1) return { answer: [...hits][0], via: "typo" };
  }
  return null;
}

export const BANK = DEFS.map(build);
export const BANK_CATS = Object.keys(CATS);

const WHY = [
  "On our list, and one of the first answers that comes to mind.",
  "On our list, and a step past the obvious.",
  "On our list, and it hides well.",
  "On our list, and about as well hidden as they come.",
];

/** A playable prompt in the same shape the math prompts use. r is a seeded random function. */
export function bankPrompt(b, r = Math.random) {
  const tierOf = (pts) => (pts >= 85 ? 3 : pts >= 60 ? 2 : pts >= 35 ? 1 : 0);
  const p = {
    type: "bank", kind: "bank", id: b.id, cat: b.cat, catName: CATS[b.cat], text: b.text,
    hint: b.hint || `${b.answers.length} right answers on our list.`,
    sample: "type an answer",
    count: b.answers.length,
    all: b.answers.map((a) => a.name),
    judge(input) {
      const raw = String(input).trim();
      if (!raw) return { status: "reject", msg: "Type an answer first." };
      const m = match(b, raw);
      if (!m) return { status: "wrong", shown: raw.slice(0, 40), msg: "That one is not on our list for this prompt.", points: 0 };
      const points = TIER_POINTS[m.answer.tier];
      const read = m.via === "typo" ? `We read that as ${m.answer.name}. ` : "";
      return { status: "ok", shown: m.answer.name, points, tier: tierOf(points), why: read + WHY[m.answer.tier] };
    },
  };
  const salt = Math.floor(r() * 1e6);
  p.examples = (skip) => {
    const out = [];
    for (let t = 0; t < 4; t++) {
      const list = b.answers.filter((a) => a.tier === t && a.name !== skip);
      if (list.length) { const a = list[(salt + t * 7) % list.length]; out.push({ text: a.name, points: TIER_POINTS[t], tier: t }); }
    }
    return out;
  };
  return p;
}

/** n bank prompts from n different categories. */
export function pickBank(r, n, shuffle) {
  const cats = shuffle(r, BANK_CATS).slice(0, n);
  return cats.map((c) => {
    const list = BANK.filter((b) => b.cat === c);
    return bankPrompt(list[Math.floor(r() * list.length)], r);
  });
}
