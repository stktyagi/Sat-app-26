export interface CampusLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  keywords?: string[];
}

export const CAMPUS_LOCATIONS: CampusLocation[] = [
  // Academic & Core
  { id: 'csed', name: 'CSED', lat: 30.354872422722643, lng: 76.3697552290389, keywords: ['csed ground floor', 'csed labs'] },
  { id: 'lt', name: 'LT (Lecture Theatres)', lat: 30.354377328586363, lng: 76.36913852795698, keywords: ['lt 101', 'lt 102', 'lt 103', 'lt 201', 'lt 202', 'lt101', 'lt102', 'lt103', 'lt201', 'lt202'] },
  { id: 'lp', name: 'LP (Lecture P-Block)', lat: 30.354281057154452, lng: 76.36869365006349, keywords: ['lp 103', 'lp 104', 'lp 108', 'lp 109', 'lp-108', 'lp-109', 'lp103', 'lp104', 'lp108', 'lp109'] },
  { id: 'as', name: 'AS / Activity Space', lat: 30.355230415103595, lng: 76.36886515246013, keywords: ['as1', 'as2', 'activity space'] },
  { id: 'main_audi', name: 'Main Auditorium', lat: 30.352024147329622, lng: 76.37090951955399, keywords: ['main audi', 'auditorium'] },
  { id: 'tan', name: 'TAN Auditorium', lat: 30.353824516700595, lng: 76.3685458971172, keywords: ['tan audi', 'tan'] },
  { id: 'c_hall', name: 'C Hall', lat: 30.353216158229223, lng: 76.37217070767521, keywords: ['chall', 'c-hall'] },
  { id: 'library', name: 'Library', lat: 30.354243494542697, lng: 76.36959239332523 },
  { id: 'health_center', name: 'Health Center', lat: 30.35595006947753, lng: 76.36855108259431, keywords: ['hospital', 'dispensary'] },

  // Grounds & Outdoors
  { id: 'fete', name: 'Fete Area', lat: 30.35396214206167, lng: 76.36481001844584, keywords: ['fete area main stage', 'fete stage'] },
  { id: 'cos', name: 'COS', lat: 30.353964101317814, lng: 76.36265569607752, keywords: ['cos'] },
  { id: 'oat', name: 'OAT (Open Air Theatre)', lat: 30.354405138715784, lng: 76.36252602522457, keywords: ['cos oat'] },
  { id: 'lp_lawns', name: 'LP Lawns', lat: 30.35477120493254, lng: 76.36845137888686 },
  { id: 'dosa_lawn', name: 'Dosa Lawn', lat: 30.354939240479453, lng: 76.37087525081559, keywords: ['waterbody'] },
  { id: 'central_park', name: 'Central Park', lat: 30.35319079019932, lng: 76.36680133578665 },
  { id: 'athletic_track', name: 'Athletic Track', lat: 30.35400005637751, lng: 76.36125881218773 },
  { id: 'hockey_ground', name: 'Hockey Ground', lat: 30.355054260749046, lng: 76.36350586160543 },
  { id: 'sports_complex', name: 'Sports Complex', lat: 30.355595211646577, lng: 76.36508296431039 },

  // Hostels
  { id: 'hostel_a', name: 'A Hostel', lat: 30.351327991274847, lng: 76.36453276525843 },
  { id: 'hostel_b', name: 'B Hostel', lat: 30.351246903377668, lng: 76.36314165240258 },
  { id: 'hostel_c', name: 'C Hostel', lat: 30.350940861204013, lng: 76.3612482838114 },
  { id: 'hostel_d', name: 'D Hostel', lat: 30.35106587926319, lng: 76.36006174804133 },
  { id: 'hostel_e', name: 'E Hostel', lat: 30.355072699678075, lng: 76.36652406644723 },
  { id: 'hostel_g', name: 'G Hostel', lat: 30.354252046207215, lng: 76.36684696615157 },
  { id: 'hostel_h', name: 'H Hostel', lat: 30.352985996456145, lng: 76.36465472696462 },
  { id: 'hostel_i', name: 'I Hostel', lat: 30.355068346942055, lng: 76.36766681779083 },
  { id: 'hostel_j', name: 'J Hostel', lat: 30.35286593527545, lng: 76.36368291231285 },
  { id: 'hostel_m', name: 'M Hostel', lat: 30.352959595421428, lng: 76.36104889932882 },
  { id: 'hostel_n', name: 'N Hostel', lat: 30.35456115154435, lng: 76.36775258431018 },
  { id: 'hostel_o', name: 'O Hostel', lat: 30.351246097829083, lng: 76.36232422905654 },
  { id: 'paavni', name: 'Paavni Hall', lat: 30.351473899916197, lng: 76.36570446264417 },
  { id: 'dhriti', name: 'Dhriti Hall', lat: 30.351514671439784, lng: 76.36646041570212 },
  { id: 'vahni', name: 'Vahni Hall', lat: 30.351784052551714, lng: 76.36759097042464 },

  // Blocks & Others
  { id: 'block_b', name: 'B Block', lat: 30.353152590588927, lng: 76.37142332674016 },
  { id: 'block_c', name: 'C Block', lat: 30.35354389079774, lng: 76.37093571665477 },
  { id: 'block_d', name: 'D Block', lat: 30.354056345897625, lng: 76.37085792538132 },
  { id: 'block_e', name: 'E Block', lat: 30.353501204419373, lng: 76.37235055617016 },
  { id: 'block_f', name: 'F Block', lat: 30.354005472911407, lng: 76.37215323385776 },
  { id: 'block_h', name: 'H Block', lat: 30.35325561867089, lng: 76.37282488468304 },
  { id: 'sbop', name: 'State Bank ATM (SBOP)', lat: 30.352733845728167, lng: 76.3704635249458, keywords: ['sbop', 'bank'] },
];
