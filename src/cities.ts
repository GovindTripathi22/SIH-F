// ============================================================
// UrbanPulse — Multi-City Configurations & Real-World Datasets
// Includes Amravati (Maharashtra), Bengaluru, Mumbai, and Pune
// ============================================================

import { CityConfig, RoadEvent, Bus } from './types';
import { simulatedEvents, simulatedBuses } from './data';

// ------------------------------------------------------------
// 1. AMRAVATI, MAHARASHTRA (MH-27)
// Center: Rajkamal / Irwin Square Corridor (20.9374° N, 77.7580° E)
// ------------------------------------------------------------

export const amravatiBuses: Bus[] = [
  {
    id: 'BUS-MH27-101',
    routeNumber: 'Route 1A',
    routeName: 'Badnera Rly Stn → Rajapeth → Panchavati',
    status: 'active',
    currentLocation: { lat: 20.9250, lng: 77.7560 },
    lastPing: new Date(Date.now() - 25000).toISOString(),
    eventsDetected: 16,
    speed: 32,
    cameraStatus: 'online',
    firmwareVersion: 'v2.4-edge-rdd'
  },
  {
    id: 'BUS-MH27-102',
    routeNumber: 'Route 3',
    routeName: 'Irwin Chowk → Gadge Nagar → SGBAU Campus',
    status: 'active',
    currentLocation: { lat: 20.9520, lng: 77.7680 },
    lastPing: new Date(Date.now() - 15000).toISOString(),
    eventsDetected: 21,
    speed: 26,
    cameraStatus: 'online',
    firmwareVersion: 'v2.4-edge-rdd'
  },
  {
    id: 'BUS-MH27-103',
    routeNumber: 'Route 5',
    routeName: 'Cotton Market → Panchavati → Walgaon MIDC',
    status: 'active',
    currentLocation: { lat: 20.9410, lng: 77.7490 },
    lastPing: new Date(Date.now() - 40000).toISOString(),
    eventsDetected: 11,
    speed: 35,
    cameraStatus: 'online',
    firmwareVersion: 'v2.4-edge-rdd'
  },
  {
    id: 'BUS-MH27-104',
    routeNumber: 'Route 7',
    routeName: 'Rajapeth → Dastur Nagar → Chhatri Talao Ring Rd',
    status: 'active',
    currentLocation: { lat: 20.9160, lng: 77.7690 },
    lastPing: new Date(Date.now() - 18000).toISOString(),
    eventsDetected: 14,
    speed: 29,
    cameraStatus: 'online',
    firmwareVersion: 'v2.4-edge-rdd'
  },
  {
    id: 'BUS-MH27-105',
    routeNumber: 'Route 2B',
    routeName: 'Camp Area → Collectorate → Maltekdi Hill',
    status: 'idle',
    currentLocation: { lat: 20.9380, lng: 77.7420 },
    lastPing: new Date(Date.now() - 120000).toISOString(),
    eventsDetected: 8,
    speed: 0,
    cameraStatus: 'online',
    firmwareVersion: 'v2.4-edge-rdd'
  },
  {
    id: 'BUS-MH27-106',
    routeNumber: 'Route 9',
    routeName: 'Kathora Naka → Rahatgaon Bypass → VMV College',
    status: 'active',
    currentLocation: { lat: 20.9610, lng: 77.7550 },
    lastPing: new Date(Date.now() - 30000).toISOString(),
    eventsDetected: 19,
    speed: 30,
    cameraStatus: 'online',
    firmwareVersion: 'v2.4-edge-rdd'
  }
];

export const amravatiEvents: RoadEvent[] = [
  {
    id: 'AMR-EVT-001',
    type: 'pothole',
    location: { lat: 20.9258, lng: 77.7582 },
    firstDetected: new Date(Date.now() - 9000000).toISOString(),
    lastDetected: new Date(Date.now() - 600000).toISOString(),
    observations: [
      {
        id: 'OBS-AMR-001-A',
        busId: 'BUS-MH27-101',
        timestamp: new Date(Date.now() - 9000000).toISOString(),
        confidence: 0.86,
        location: { lat: 20.9258, lng: 77.7582 }
      },
      {
        id: 'OBS-AMR-001-B',
        busId: 'BUS-MH27-104',
        timestamp: new Date(Date.now() - 4500000).toISOString(),
        confidence: 0.91,
        location: { lat: 20.9259, lng: 77.7583 }
      },
      {
        id: 'OBS-AMR-001-C',
        busId: 'BUS-MH27-101',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        confidence: 0.95,
        location: { lat: 20.9258, lng: 77.7582 }
      }
    ],
    status: 'verified',
    priority: 'critical',
    severity: 8,
    description: 'Deep impact pothole (~45cm diameter, 9cm depth) on Badnera Road NH-53 approach, severe two-wheeler skid hazard',
    address: 'Badnera Road near Rajapeth Flyover landing, Amravati',
    createdAt: new Date(Date.now() - 9000000).toISOString(),
    updatedAt: new Date(Date.now() - 600000).toISOString()
  },
  {
    id: 'AMR-EVT-002',
    type: 'road_crack',
    location: { lat: 20.9465, lng: 77.7650 },
    firstDetected: new Date(Date.now() - 14400000).toISOString(),
    lastDetected: new Date(Date.now() - 1200000).toISOString(),
    observations: [
      {
        id: 'OBS-AMR-002-A',
        busId: 'BUS-MH27-102',
        timestamp: new Date(Date.now() - 14400000).toISOString(),
        confidence: 0.81,
        location: { lat: 20.9465, lng: 77.7650 }
      },
      {
        id: 'OBS-AMR-002-B',
        busId: 'BUS-MH27-103',
        timestamp: new Date(Date.now() - 1200000).toISOString(),
        confidence: 0.87,
        location: { lat: 20.9466, lng: 77.7651 }
      }
    ],
    status: 'verified',
    priority: 'high',
    severity: 6,
    description: 'Extensive longitudinal fatigue cracking along left carriageway edge on Morshi State Highway',
    address: 'Panchavati Square to Tapovan corridor, Morshi Road, Amravati',
    createdAt: new Date(Date.now() - 14400000).toISOString(),
    updatedAt: new Date(Date.now() - 1200000).toISOString()
  },
  {
    id: 'AMR-EVT-003',
    type: 'waterlogging',
    location: { lat: 20.9320, lng: 77.7510 },
    firstDetected: new Date(Date.now() - 7200000).toISOString(),
    lastDetected: new Date(Date.now() - 900000).toISOString(),
    observations: [
      {
        id: 'OBS-AMR-003-A',
        busId: 'BUS-MH27-101',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        confidence: 0.89,
        location: { lat: 20.9320, lng: 77.7510 }
      },
      {
        id: 'OBS-AMR-003-B',
        busId: 'BUS-MH27-102',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        confidence: 0.94,
        location: { lat: 20.9321, lng: 77.7511 }
      },
      {
        id: 'OBS-AMR-003-C',
        busId: 'BUS-MH27-105',
        timestamp: new Date(Date.now() - 900000).toISOString(),
        confidence: 0.96,
        location: { lat: 20.9320, lng: 77.7510 }
      }
    ],
    status: 'actioned',
    priority: 'critical',
    severity: 9,
    description: 'Severe storm drain overflow (>25cm water depth) blocking passage between Irwin Square and Railway Station subway',
    address: 'Irwin Hospital Square underpass, Amravati',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 900000).toISOString()
  },
  {
    id: 'AMR-EVT-004',
    type: 'pothole',
    location: { lat: 20.9680, lng: 77.7725 },
    firstDetected: new Date(Date.now() - 10800000).toISOString(),
    lastDetected: new Date(Date.now() - 1800000).toISOString(),
    observations: [
      {
        id: 'OBS-AMR-004-A',
        busId: 'BUS-MH27-102',
        timestamp: new Date(Date.now() - 10800000).toISOString(),
        confidence: 0.83,
        location: { lat: 20.9680, lng: 77.7725 }
      },
      {
        id: 'OBS-AMR-004-B',
        busId: 'BUS-MH27-106',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        confidence: 0.90,
        location: { lat: 20.9681, lng: 77.7726 }
      }
    ],
    status: 'verified',
    priority: 'high',
    severity: 7,
    description: 'Asphalt disintegration and clustered potholes on SGBAU University Gate approach road',
    address: 'Sant Gadge Baba Amravati University Gate, Tapovan Road, Amravati',
    createdAt: new Date(Date.now() - 10800000).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString()
  },
  {
    id: 'AMR-EVT-005',
    type: 'traffic_congestion',
    location: { lat: 20.9335, lng: 77.7565 },
    firstDetected: new Date(Date.now() - 1800000).toISOString(),
    lastDetected: new Date(Date.now() - 120000).toISOString(),
    observations: [
      {
        id: 'OBS-AMR-005-A',
        busId: 'BUS-MH27-101',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        confidence: 0.92,
        location: { lat: 20.9335, lng: 77.7565 }
      },
      {
        id: 'OBS-AMR-005-B',
        busId: 'BUS-MH27-105',
        timestamp: new Date(Date.now() - 120000).toISOString(),
        confidence: 0.96,
        location: { lat: 20.9335, lng: 77.7565 }
      }
    ],
    status: 'verified',
    priority: 'medium',
    severity: 6,
    description: 'Heavy congestion around central market intersection; bus speeds under 7 km/h for 25 mins',
    address: 'Rajkamal Chowk, Amravati',
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    updatedAt: new Date(Date.now() - 120000).toISOString()
  },
  {
    id: 'AMR-EVT-006',
    type: 'road_sign_damage',
    location: { lat: 20.9540, lng: 77.7420 },
    firstDetected: new Date(Date.now() - 21600000).toISOString(),
    lastDetected: new Date(Date.now() - 7200000).toISOString(),
    observations: [
      {
        id: 'OBS-AMR-006-A',
        busId: 'BUS-MH27-103',
        timestamp: new Date(Date.now() - 21600000).toISOString(),
        confidence: 0.77,
        location: { lat: 20.9540, lng: 77.7420 }
      }
    ],
    status: 'pending_verify',
    priority: 'low',
    severity: 4,
    description: 'Speed limit and heavy vehicle clearance sign tilted 35 degrees, obscured by roadside vegetation',
    address: 'Walgaon MIDC Road, Near Transport Nagar, Amravati',
    createdAt: new Date(Date.now() - 21600000).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: 'AMR-EVT-007',
    type: 'zebra_crossing_deficiency',
    location: { lat: 20.9180, lng: 77.7680 },
    firstDetected: new Date(Date.now() - 172800000).toISOString(),
    lastDetected: new Date(Date.now() - 3600000).toISOString(),
    observations: [
      {
        id: 'OBS-AMR-007-A',
        busId: 'BUS-MH27-104',
        timestamp: new Date(Date.now() - 172800000).toISOString(),
        confidence: 0.80,
        location: { lat: 20.9180, lng: 77.7680 }
      },
      {
        id: 'OBS-AMR-007-B',
        busId: 'BUS-MH27-104',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        confidence: 0.85,
        location: { lat: 20.9181, lng: 77.7681 }
      }
    ],
    status: 'verified',
    priority: 'medium',
    severity: 5,
    description: 'Pedestrian zebra crossing completely eroded near Dastur Nagar school zone; needs repainting',
    address: 'Dastur Nagar Chowk, Amravati',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'AMR-EVT-008',
    type: 'pothole',
    location: { lat: 20.9385, lng: 77.7450 },
    firstDetected: new Date(Date.now() - 86400000).toISOString(),
    lastDetected: new Date(Date.now() - 7200000).toISOString(),
    observations: [
      {
        id: 'OBS-AMR-008-A',
        busId: 'BUS-MH27-105',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        confidence: 0.84,
        location: { lat: 20.9385, lng: 77.7450 }
      }
    ],
    status: 'resolved',
    priority: 'low',
    severity: 4,
    description: 'Surface pothole repaired by PWD Amravati City Division; 2 consecutive clean bus passes verified',
    address: 'Camp Road near District Collectorate, Amravati',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString()
  }
];

// ------------------------------------------------------------
// 2. MUMBAI, MAHARASHTRA (MH-01 / MH-02)
// Center: Kalanagar / Bandra-Kurla Corridor (19.0600° N, 72.8500° E)
// ------------------------------------------------------------

export const mumbaiBuses: Bus[] = [
  {
    id: 'BUS-MH01-401',
    routeNumber: 'Route C-71',
    routeName: 'CSMT → Bandra → Andheri Station',
    status: 'active',
    currentLocation: { lat: 19.0600, lng: 72.8450 },
    lastPing: new Date(Date.now() - 20000).toISOString(),
    eventsDetected: 28,
    speed: 34,
    cameraStatus: 'online',
    firmwareVersion: 'v2.4-edge-rdd'
  },
  {
    id: 'BUS-MH02-502',
    routeNumber: 'Route 302',
    routeName: 'Dadar → Sion → Kurla Kamani',
    status: 'active',
    currentLocation: { lat: 19.0700, lng: 72.8750 },
    lastPing: new Date(Date.now() - 15000).toISOString(),
    eventsDetected: 35,
    speed: 22,
    cameraStatus: 'online',
    firmwareVersion: 'v2.4-edge-rdd'
  },
  {
    id: 'BUS-MH01-403',
    routeNumber: 'Route A-115',
    routeName: 'Churchgate → Worli Naka → Bandra Reclamation',
    status: 'active',
    currentLocation: { lat: 19.0150, lng: 72.8220 },
    lastPing: new Date(Date.now() - 35000).toISOString(),
    eventsDetected: 14,
    speed: 40,
    cameraStatus: 'online',
    firmwareVersion: 'v2.4-edge-rdd'
  }
];

export const mumbaiEvents: RoadEvent[] = [
  {
    id: 'MUM-EVT-001',
    type: 'pothole',
    location: { lat: 19.1136, lng: 72.8697 },
    firstDetected: new Date(Date.now() - 10800000).toISOString(),
    lastDetected: new Date(Date.now() - 900000).toISOString(),
    observations: [
      {
        id: 'OBS-MUM-001-A',
        busId: 'BUS-MH01-401',
        timestamp: new Date(Date.now() - 10800000).toISOString(),
        confidence: 0.91,
        location: { lat: 19.1136, lng: 72.8697 }
      },
      {
        id: 'OBS-MUM-001-B',
        busId: 'BUS-MH02-502',
        timestamp: new Date(Date.now() - 900000).toISOString(),
        confidence: 0.94,
        location: { lat: 19.1137, lng: 72.8698 }
      }
    ],
    status: 'verified',
    priority: 'critical',
    severity: 9,
    description: 'Cluster of deep potholes on Andheri-Kurla Road near Saki Naka Junction, heavy congestion trigger',
    address: 'Andheri-Kurla Road, Saki Naka, Mumbai',
    createdAt: new Date(Date.now() - 10800000).toISOString(),
    updatedAt: new Date(Date.now() - 900000).toISOString()
  },
  {
    id: 'MUM-EVT-002',
    type: 'waterlogging',
    location: { lat: 19.0430, lng: 72.8620 },
    firstDetected: new Date(Date.now() - 5400000).toISOString(),
    lastDetected: new Date(Date.now() - 300000).toISOString(),
    observations: [
      {
        id: 'OBS-MUM-002-A',
        busId: 'BUS-MH02-502',
        timestamp: new Date(Date.now() - 5400000).toISOString(),
        confidence: 0.93,
        location: { lat: 19.0430, lng: 72.8620 }
      }
    ],
    status: 'actioned',
    priority: 'critical',
    severity: 9,
    description: 'Monsoon water accumulation (35cm depth) near Gandhi Market, Sion, slowing northbound traffic',
    address: 'Gandhi Market, King Circle, Sion, Mumbai',
    createdAt: new Date(Date.now() - 5400000).toISOString(),
    updatedAt: new Date(Date.now() - 300000).toISOString()
  },
  {
    id: 'MUM-EVT-003',
    type: 'road_crack',
    location: { lat: 19.0620, lng: 72.8530 },
    firstDetected: new Date(Date.now() - 18000000).toISOString(),
    lastDetected: new Date(Date.now() - 3600000).toISOString(),
    observations: [
      {
        id: 'OBS-MUM-003-A',
        busId: 'BUS-MH01-401',
        timestamp: new Date(Date.now() - 18000000).toISOString(),
        confidence: 0.85,
        location: { lat: 19.0620, lng: 72.8530 }
      }
    ],
    status: 'verified',
    priority: 'high',
    severity: 7,
    description: 'Severe longitudinal bridge joint gap on Kalanagar Flyover approach',
    address: 'Western Express Highway, Kalanagar Junction, Bandra East, Mumbai',
    createdAt: new Date(Date.now() - 18000000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString()
  }
];

// ------------------------------------------------------------
// 3. PUNE, MAHARASHTRA (MH-12)
// Center: Shivajinagar / FC Road (18.5204° N, 73.8567° E)
// ------------------------------------------------------------

export const puneBuses: Bus[] = [
  {
    id: 'BUS-MH12-201',
    routeNumber: 'Route 100',
    routeName: 'Pune Station → Shivajinagar → Hinjawadi Phase 3',
    status: 'active',
    currentLocation: { lat: 18.5300, lng: 73.8400 },
    lastPing: new Date(Date.now() - 10000).toISOString(),
    eventsDetected: 24,
    speed: 31,
    cameraStatus: 'online',
    firmwareVersion: 'v2.4-edge-rdd'
  },
  {
    id: 'BUS-MH12-202',
    routeNumber: 'Route 24',
    routeName: 'Swargate → Deccan Gymkhana → Kothrud Depot',
    status: 'active',
    currentLocation: { lat: 18.5080, lng: 73.8250 },
    lastPing: new Date(Date.now() - 25000).toISOString(),
    eventsDetected: 17,
    speed: 28,
    cameraStatus: 'online',
    firmwareVersion: 'v2.4-edge-rdd'
  }
];

export const puneEvents: RoadEvent[] = [
  {
    id: 'PUN-EVT-001',
    type: 'pothole',
    location: { lat: 18.5913, lng: 73.7389 },
    firstDetected: new Date(Date.now() - 7200000).toISOString(),
    lastDetected: new Date(Date.now() - 600000).toISOString(),
    observations: [
      {
        id: 'OBS-PUN-001-A',
        busId: 'BUS-MH12-201',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        confidence: 0.88,
        location: { lat: 18.5913, lng: 73.7389 }
      },
      {
        id: 'OBS-PUN-001-B',
        busId: 'BUS-MH12-201',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        confidence: 0.93,
        location: { lat: 18.5914, lng: 73.7390 }
      }
    ],
    status: 'verified',
    priority: 'critical',
    severity: 8,
    description: 'Pothole cluster at Shivaji Chowk Hinjawadi Phase 1, causing bottleneck for IT commuters',
    address: 'Hinjawadi IT Park Main Road, Phase 1, Pune',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 600000).toISOString()
  },
  {
    id: 'PUN-EVT-002',
    type: 'road_crack',
    location: { lat: 18.5196, lng: 73.8415 },
    firstDetected: new Date(Date.now() - 14400000).toISOString(),
    lastDetected: new Date(Date.now() - 1800000).toISOString(),
    observations: [
      {
        id: 'OBS-PUN-002-A',
        busId: 'BUS-MH12-202',
        timestamp: new Date(Date.now() - 14400000).toISOString(),
        confidence: 0.82,
        location: { lat: 18.5196, lng: 73.8415 }
      }
    ],
    status: 'verified',
    priority: 'medium',
    severity: 5,
    description: 'Transverse thermal cracks along left bus lane on Karve Road near SNDT College',
    address: 'Karve Road, Erandwane, Pune',
    createdAt: new Date(Date.now() - 14400000).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString()
  }
];

// ------------------------------------------------------------
// 4. BENGALURU, KARNATAKA (KA-01)
// ------------------------------------------------------------

export const amravatiCityConfig: CityConfig = {
  id: 'amravati',
  name: 'Amravati',
  state: 'Maharashtra',
  stateCode: 'MH',
  center: { lat: 20.9374, lng: 77.7580 },
  zoom: 13,
  authorityName: 'Amravati Municipal Corporation (AMC)',
  authorityShort: 'AMC',
  pwdDivision: 'Maharashtra PWD — Amravati City Division',
  trafficPolice: 'Amravati City Traffic Police',
  transitAgency: 'Amravati City Bus Transport (MSRTC/AMC)',
  fleetPrefix: 'BUS-MH27',
  corridors: [
    'Badnera Road Corridor (NH-53)',
    'Morshi Road Corridor',
    'Walgaon MIDC Corridor',
    'Camp & University Road',
    'Rajkamal - Cotton Market Corridor'
  ],
  issues: amravatiEvents,
  buses: amravatiBuses
};

export const bengaluruCityConfig: CityConfig = {
  id: 'bengaluru',
  name: 'Bengaluru',
  state: 'Karnataka',
  stateCode: 'KA',
  center: { lat: 12.9716, lng: 77.5946 },
  zoom: 12,
  authorityName: 'Bruhat Bengaluru Mahanagara Palike (BBMP)',
  authorityShort: 'BBMP',
  pwdDivision: 'Karnataka PWD — Bengaluru Urban Division',
  trafficPolice: 'Bengaluru Traffic Police (BTP)',
  transitAgency: 'Bangalore Metropolitan Transport Corp (BMTC)',
  fleetPrefix: 'BUS-KA01',
  corridors: [
    'Outer Ring Road (Silk Board - Hebbal)',
    'Hosur Road Corridor',
    'Old Airport Road',
    'Whitefield ITPL Corridor'
  ],
  issues: simulatedEvents,
  buses: simulatedBuses
};

export const mumbaiCityConfig: CityConfig = {
  id: 'mumbai',
  name: 'Mumbai',
  state: 'Maharashtra',
  stateCode: 'MH',
  center: { lat: 19.0760, lng: 72.8777 },
  zoom: 12,
  authorityName: 'Brihanmumbai Municipal Corporation (BMC)',
  authorityShort: 'BMC',
  pwdDivision: 'Maharashtra PWD — Mumbai Suburban Division',
  trafficPolice: 'Mumbai Traffic Police',
  transitAgency: 'Brihanmumbai Electric Supply & Transport (BEST)',
  fleetPrefix: 'BUS-MH01',
  corridors: [
    'Western Express Highway (WEH)',
    'Eastern Express Highway (EEH)',
    'SV Road Suburban Corridor',
    'Andheri-Kurla Road Corridor'
  ],
  issues: mumbaiEvents,
  buses: mumbaiBuses
};

export const puneCityConfig: CityConfig = {
  id: 'pune',
  name: 'Pune',
  state: 'Maharashtra',
  stateCode: 'MH',
  center: { lat: 18.5204, lng: 73.8567 },
  zoom: 12,
  authorityName: 'Pune Municipal Corporation (PMC)',
  authorityShort: 'PMC',
  pwdDivision: 'Maharashtra PWD — Pune City Division',
  trafficPolice: 'Pune City Traffic Branch',
  transitAgency: 'Pune Mahanagar Parivahan Mahamandal Ltd (PMPML)',
  fleetPrefix: 'BUS-MH12',
  corridors: [
    'FC Road & JM Road Arterial',
    'Hinjawadi IT Expressway Corridor',
    'Karve Road Arterial',
    'Pune-Satara Road'
  ],
  issues: puneEvents,
  buses: puneBuses
};

export const SUPPORTED_CITIES: CityConfig[] = [
  amravatiCityConfig,
  bengaluruCityConfig,
  mumbaiCityConfig,
  puneCityConfig
];

export function getCityConfig(cityId: string): CityConfig {
  return SUPPORTED_CITIES.find(c => c.id === cityId) || amravatiCityConfig;
}
