// Where each experiment applies on the station. The Application section (the Freefall
// Fire Console) is opened with ?exp=<id>&focus=<zone>; bridge.js reads this table, flies
// the camera to the zone and adds the experiment's finding to the console's briefing.
//
// zone  = one of the console's zones: vent, smoke, battery, o2, quarters, ext, rack
// kind  = 'danger' (a hazard the experiment revealed), 'application' (what the result is
//         used for) or 'site' (where the experiment itself ran)
// place = short name shown on the chip
(() => {
  const PLACE = { vent: 'Ventilation', smoke: 'Smoke detectors', o2: 'Oxygen system', quarters: 'Crew quarters', ext: 'Fire extinguishers', rack: 'Research rack' };
  const item = (zone, kind, head, text) => ({ zone, kind, place: PLACE[zone], head, text });
  const danger = (zone, head, text) => item(zone, 'danger', head, text);
  const use = (zone, head, text) => item(zone, 'application', head, text);
  const ran = (name, text) => item('rack', 'site', `${name} ran here`, text);
  const lab = (engine, id) => `../lab.html?engine=${engine}&exp=${id}`;
  const CIR = 'inside the Combustion Integrated Rack in Destiny, a sealed chamber built for burning things safely.';

  const coolFlame = danger('ext', 'A fire that looks out may not be out',
    'Large fuel droplets lost their visible flame and then kept burning as a cool flame for tens of seconds. Eyes and ordinary cameras miss it, it keeps making toxic gases, and it can flash back into a hot flame.');
  const stopAir = use('vent', 'Stopping the air starves the flame',
    'In orbit a flame gets oxygen only from moving air. With the fans off it goes out within seconds, which is why switching ventilation off is the first step of the station\'s fire response.');
  const richAir = (text) => danger('o2', 'Richer air changes the answer', text);
  const sootSeen = use('smoke', 'Soot is what a detector sees',
    'How much soot a flame makes, and when it escapes, decides what reaches a smoke detector. These measurements calibrate the soot models behind detector design.');

  window.FREEFALL_EXPERIMENTS = {
    flex: { name: 'FLEX', title: 'Droplet flames', back: '../droplet.html?exp=flex', items: [
      coolFlame,
      use('ext', 'It sizes the gas extinguishers stowed here', 'FLEX measured how much carbon dioxide or helium it takes to put a droplet flame out at each oxygen level and pressure. Those limits tell designers how much agent an extinguisher must deliver, and what it costs: enough carbon dioxide to stop a fire is also toxic in a sealed cabin.'),
      richAir('FLEX burned droplets from 12% to 34% oxygen. Near 30%, the level planned for the Moon Base, the FLEX-fitted model has a 3.6 mm heptane droplet burning about 40% faster than in cabin air, and to completion instead of dying early.'),
      use('o2', 'It sets the oxygen level to qualify against', 'Use the FLEX limits to check that suppression still works at the highest oxygen level a habitat will run, not only at the 21% of today\'s station.'),
      ran('FLEX', `The droplets burned ${CIR}`)] },
    flex2: { name: 'FLEX-2', title: 'Droplets in a breeze', back: '../droplet.html?exp=flex2', items: [
      danger('vent', 'A slow breeze keeps a droplet burning', 'In still air a large droplet\'s flame dies early. FLEX-2 showed that even a few centimetres per second of airflow, like cabin ventilation, brings enough oxygen to keep it alive and burning faster.'),
      use('ext', 'Suppression for real fuels', 'FLEX-2 burned fuel mixtures closer to real liquids than the pure fuels of FLEX, so extinguisher limits can be set for what is actually on board.'),
      ran('FLEX-2', `The droplets burned ${CIR}`)] },
    cfi: { name: 'CFI', title: 'Cool flames', back: '../droplet.html?exp=cfi', items: [
      coolFlame,
      use('smoke', 'Why gas sensors matter', 'A cool flame gives off almost no light and little smoke, but it does give off carbon monoxide and other gases. Gas sensing can catch what a smoke detector cannot.'),
      ran('CFI', `The dodecane droplets burned ${CIR}`)] },
    bass: { name: 'BASS', title: 'Burning solids', back: lab('solid', 'bass'), items: [
      danger('quarters', 'Fabric and plastic burn steadily in a gentle breeze', 'BASS showed flames on everyday materials do not flicker out in orbit. They creep along at a steady pace for as long as ventilation feeds them.'),
      stopAir] },
    bass2: { name: 'BASS-II', title: 'Finding the limit', back: lab('solid', 'bass2'), items: [
      use('o2', 'It maps the oxygen limit of each material', 'BASS-II lowered the oxygen from 22% to under 14% to find where flames on acrylic and fabric go out. Those limits are what material selection for a habitat rests on.'),
      danger('quarters', 'Gentle airflow is the worst case', 'The flame is hardest to put out at low air speeds like those of cabin ventilation, not in a strong draught.'),
      stopAir] },
    saffire1: { name: 'Saffire-I', title: 'A fire the size of a person', back: lab('solid', 'saffire1'), items: [
      danger('quarters', 'A large fire grows steadily, not explosively', 'Saffire-I burned a 40 by 94 cm cotton-fibreglass sheet in a Cygnus cargo ship. The flame spread at a steady, limited pace: slower than on Earth, but it did not stop.'),
      use('vent', 'Airflow sets the pace', 'The spread rate followed the air speed, so controlling ventilation controls how fast a large fire grows.')] },
    saffire2: { name: 'Saffire-II', title: 'Nine materials', back: lab('solid', 'saffire2'), items: [
      use('quarters', 'It tells you which materials to fly', 'Of nine real spacecraft materials, cotton-fibreglass burned along its whole length while silicone and Nomex did not burn in orbit at 22% oxygen. Crew quarters are built from the ones that did not.'),
      richAir('Those results hold at 22% oxygen. In the 30% or more planned for the Moon Base, the model has Nomex burning too.')] },
    saffire3: { name: 'Saffire-III', title: 'The big sheet, faster air', back: lab('solid', 'saffire3'), items: [
      danger('quarters', 'Faster air, faster fire', 'Saffire-III repeated the large-sheet burn with faster airflow to see how much quicker a realistic fire grows.'),
      stopAir] },
    same: { name: 'SAME', title: 'Smoke in orbit', back: lab('smoke', 'same'), items: [
      danger('smoke', 'Some smoke is too fine for the detector', 'SAME found that overheated Teflon and Kapton make particles far smaller than the smoke detectors are tuned for. A light-scattering detector, the kind on the station, responds weakly to them.'),
      danger('vent', 'No airflow, no alarm', 'Smoke does not rise in orbit. With ventilation off it stays in a ball around its source and never reaches a detector.'),
      use('smoke', 'It sets what a detector must see', 'The measured particle sizes for real spacecraft materials are the target future detectors are designed against.')] },
    samer: { name: 'SAME-R', title: 'Smoke, measured again', back: lab('smoke', 'samer'), items: [
      use('smoke', 'Better numbers for detector design', 'SAME-R repeated the smoke measurements with improved instruments and collected particles for microscopes on the ground, tightening the sizes detectors are designed against.'),
      danger('vent', 'No airflow, no alarm', 'Smoke does not rise in orbit. With ventilation off it stays around its source and never reaches a detector.')] },
    daft: { name: 'DAFT', title: 'Counting dust', back: lab('smoke', 'daft'), items: [
      danger('smoke', 'Dust can look like smoke', 'Cabin dust is made of large particles that scatter light strongly, which is exactly what a light-scattering detector responds to. That means false alarms.'),
      use('smoke', 'It proved the instrument works in orbit', 'DAFT showed a commercial particle counter works without gravity, so SAME could use it to measure smoke.')] },
    daft2: { name: 'DAFT-2', title: 'Counting dust, again', back: lab('smoke', 'daft2'), items: [
      danger('smoke', 'Dust can look like smoke', 'Large dust particles scatter light strongly and can trip a light-scattering detector, causing false alarms.'),
      use('smoke', 'A tested instrument for smoke work', 'DAFT-2 finished the instrument checks that the smoke experiments relied on.')] },
    spice: { name: 'SPICE', title: 'When a flame starts to smoke', back: lab('jet', 'spice'), items: [
      danger('smoke', 'Flames smoke sooner in orbit', 'SPICE found that a gas flame starts to release soot at a much smaller size in orbit than on Earth, because soot has longer to form.'),
      sootSeen] },
    slice: { name: 'SLICE', title: 'Lifting a flame off', back: lab('jet', 'slice'), items: [
      danger('vent', 'A blown-out flame is not a stopped leak', 'SLICE thinned the fuel until airflow lifted the flame off and blew it out. The gas kept flowing afterwards: unburned fuel then spreads through the cabin.'),
      use('vent', 'How much airflow a flame survives', 'The lift-off and blow-out limits say when ventilation removes a small flame and when it only feeds it.')] },
    cld: { name: 'CLD Flame', title: 'From sooty to blue', back: lab('jet', 'cld'), items: [
      sootSeen,
      ran('CLD Flame', `The coflow burner ran ${CIR}`)] },
    efield: { name: 'E-FIELD Flames', title: 'Pulling on a flame', back: lab('jet', 'efield'), items: [
      use('o2', 'A stand-in for Moon and Mars gravity', 'An electric field pulls on a flame much as buoyancy does. Until partial-gravity fire data exist, this is one way to estimate how flames behave in Moon and Mars habitats.'),
      ran('E-FIELD Flames', `The burner and its charged mesh ran ${CIR}`)] },
    sflame: { name: 's-Flame', title: 'A ball of flame', back: lab('burner', 'sflame'), items: [
      use('ext', 'Flames can put themselves out', 'In still gas a flame ball grows, radiates its heat away and goes out. Knowing when that happens tells designers which small fires need no agent at all.'),
      danger('ext', 'The gas keeps coming', 'When the flame dies the fuel is still flowing. It collects unburned, ready to light again.'),
      ran('s-Flame', `The spherical burner ran ${CIR}`)] },
    flamedesign: { name: 'Flame Design', title: 'Designing soot away', back: lab('burner', 'flamedesign'), items: [
      sootSeen,
      ran('Flame Design', `The spherical burner ran ${CIR}`)] },
    cfig: { name: 'CFI-G', title: 'Inside-out flames', back: lab('burner', 'cfig'), items: [
      richAir('CFI-G burned with up to 85% oxygen, the richest microgravity tests in NASA\'s database. Flames that cannot light at 12% oxygen burn hot and steady there.'),
      use('o2', 'The far end of the oxygen scale', 'These tests bound how flames behave in oxygen-rich pockets, such as near a leak from the oxygen system.'),
      ran('CFI-G', `The inside-out flames burned ${CIR}`)] },
    bre: { name: 'BRE', title: 'A stand-in for burning plastic', back: lab('burner', 'bre'), items: [
      use('quarters', 'Which materials go out in still air', 'BRE used a gas burner to imitate a burning solid. In still cabin air its flame grew, cooled and went out, which says how materials behave once ventilation is off.'),
      richAir('With more oxygen the same flame survived in still air. Switching the fans off stops being enough.'),
      ran('BRE', `The burner disc ran ${CIR}`)] },
  };

  // One line of facts per place, for the guide (ChatGPT) in the Application section.
  window.FREEFALL_ZONES = {
    vent: { name: 'Ventilation', facts: 'Fans are the only thing moving air in orbit. A flame gets fresh oxygen from that flow and spreads fastest along it. First response to a fire: stop ventilation in that module.' },
    smoke: { name: 'Smoke detectors', facts: 'Smoke in space can have a different particle size than on Earth (SAME experiment). With ventilation off, smoke stays near its source and never reaches a detector.' },
    cables: { name: 'Wiring', facts: 'Electrical overheating behind panels.' },
    battery: { name: 'Batteries', facts: 'A lithium-ion cell in thermal runaway feeds itself, so cutting airflow does not stop it. Stop charging, isolate it and cool it; water-based agents cool best.' },
    o2: { name: 'Oxygen system', facts: 'More oxygen makes almost everything easier to light and faster to burn. Moon and Mars habitats may use about 34% oxygen at 8.2 psia. The 1997 Mir fire started in an oxygen generator.' },
    quarters: { name: 'Crew quarters', facts: 'Fabric, foam and Velcro sit close to a sleeping crew member. Saffire burned a large fabric sheet in space to see how a realistic fire grows.' },
    ext: { name: 'Fire extinguishers', facts: 'Carbon dioxide extinguishers and breathing masks are stowed near the hatches. FLEX showed a fire can keep burning as an invisible cool flame after it looks out.' },
    rack: { name: 'Research rack', facts: 'The Combustion Integrated Rack in the US Lab is a sealed chamber where FLEX and ACME burn fuels safely. Flames there are spherical, dim and often blue.' },
  };
})();
