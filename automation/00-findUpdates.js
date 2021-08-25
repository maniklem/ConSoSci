get('https://kf.kobotoolbox.org/api/v2/assets/?format=json', {}, state => {
  console.log(`Previous cursor: ${state.lastEnd}`);
  // Set a manual cursor if you'd like to only fetch form after a certain date
  const manualCursor = '2019-05-25T14:32:43.325+01:00';

  // ===========================================================================
  // == FOR ADMINS: Update the below `manualFormList` to designate which Kobo forms to sync ==//
  const manualFormList = [
    {
      uid: 'apZrpKcK78xzrPcAfRrfac',
      p1: 'WCSPROGRAMS',
      p2: '',
      tableId: 'SharksRays',
    },
    //=== WCS Socio Economic Database =====
    // {
    //     uid: 'aukhdejQU76K33caCkF4rP',
    //     p1: 'WCSPROGRAMS',
    //     p2: '',
    //     tableId: 'SocioEcoDB'
    //   },
    //=== Trillion Trees forms =====
    // { 
    //   uid: 'aHPGTtrrLB4k3xDA9UZipu',
    //   p1: 'WCSPROGRAMS',
    //   p2: '',
    //   tableId: 'Site',
    // },
    // {
    //   uid: 'a8ffyF7HgbFUEnYBppEL79',
    //   p1: 'WCSPROGRAMS',
    //   p2: '',
    //   tableId: 'Land',
    // },
    //=================================
    // { 
    //   uid: 'avLpvrukkvuFzCHacjHdRs', 
    //   p1: 'WCS', 
    //   p2: 'Vegetation', 
    //   tableId: 'VegetationClassficationAndTreeMeasurementForm'},

    //{ uid: 'apZrpKcK78xzrPcAfRrfac', p1: 'OpenFn', p2: 'Sharks', tableId: 'SharkRaysMay4Test'},
    //{ uid: 'azg4rJb2Kk8DT2upSPyYjB', p1: 'WCS', p2: 'Livestock', tableId: 'LivestockProduction'},
    //{ uid: 'aDgPJqN4SAYohZ4ZueEeYU', p1: 'WCS', p2: 'Arcadia', tableId: 'ArcadiaDataCollection'},
    //{ uid: 'a7Dx4vpFcj7ziwaKE4682U', p1: 'WCS', p2: 'Vegetation', tableId: 'VegetationClassficationAndTreeMeasurementForm'},
    //{ uid: 'apZrpKcK78xzrPcAfRrfac', p1: 'WCS', p2: 'SR', tableId: 'SharkAndRaysTraining'}
  ];

  state.data.forms = state.data.results
    // Filter the response from Kobo to show only those forms we want to update.
    .filter(form => manualFormList.map(x => x.uid).includes(form.uid))
    .filter(form => {
      // Note: If a form in manualFormList was not present in the list during
      // the last run of the job (formsWatched), then we always trigger an
      // update for that form.
      if (!state.formsWatched) {
        return true;
      }
      if (!state.formsWatched.find(f => f.uid === form.uid)) {
        console.log(`New form ${form.uid} (${form.name}) added to watch list.`);
        return true;
      }
      // Note: If a form is not NEW to the watch list, then we only trigger an
      // update if it has been modified more recently than the greatest
      // last-modified date across all forms from our last run.
      return form.date_modified > (state.lastEnd || manualCursor);
    })
    // Map those forms so that we can post each to the inbox later.
    .map(form => {
      const url = form.url.split('?').join('?');
      const manualSpec = manualFormList.find(f => f.uid === form.uid);
      return {
        formId: form.uid,
        tag: manualSpec.surveyTable || form.name,
        //tag: form.name,
        url,
        prefix1: manualSpec.p1,
        prefix2: manualSpec.p2 || '',
        tableId: manualSpec.tableId,
        lastModified: form.date_modified,
      };
    });

  // Set lastEnd to the greatest date_modified value for all forms we care about.
  const lastEnd = state.data.results
    .filter(item => item.date_modified)
    .map(s => s.date_modified)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  console.log(
    'Detected changes for:',
    JSON.stringify(
      state.data.forms.map(f => f.url),
      null,
      2
    )
  );

  return { ...state, lastEnd, formsWatched: manualFormList };
});

each(dataPath('forms[*]'), state => {
  const form = state.data;
  return post(
    state.configuration.openfnInboxUrl,
    { body: { ...form, formUpdate: true } },
    state => {
      console.log('Sent ', form.tag, ' for handling:');
      console.log(form);
      return state;
    }
  )(state);
});

// Clear everything from state but the required cursors.
alterState(state => ({
  lastEnd: state.lastEnd,
  formsWatched: state.formsWatched,
}));
