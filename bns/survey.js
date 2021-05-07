// NOTE: This data cleaning operation returns state, modified as needed.
alterState(state => {
  try {
    const { body, formName } = state.data;
    const { _submission_time, _id, _xform_id_string } = body;

    let cleanedSubmission = {};

    for (const key in body) {
      switch (body[key]) {
        case 'yes':
          cleanedSubmission[key] = 1;
          break;

        case 'no':
          cleanedSubmission[key] = 0;
          break;

        default:
          cleanedSubmission[key] = body[key];
          break;
      }
    }

    // NOTE: This assumes all device-collected geo data follows specific lat, log data format
    if (cleanedSubmission.gps_method === 'device') {
      cleanedSubmission['gps/lat'] =
        cleanedSubmission.geo && cleanedSubmission.geo.split(' ')[0];
      cleanedSubmission['gps/long'] =
        cleanedSubmission.geo && cleanedSubmission.geo.split(' ')[1];
    } else if (
      Math.abs(parseFloat(cleanedSubmission['gps/lat'])) > 90 ||
      Math.abs(parseFloat(cleanedSubmission['gps/long'])) > 180
    ) {
      console.log(
        `WARNING: Discarding invalid manual GPS entry: 'gps/lat': ${cleanedSubmission['gps/lat']}; 'gps/long': ${cleanedSubmission['gps/long']}`
      );
      delete cleanedSubmission['gps/lat'];
      delete cleanedSubmission['gps/long'];
    }

    cleanedSubmission.durableUUID = `${_submission_time}-${_xform_id_string}-${_id}`; //survey uuid
    cleanedSubmission.datasetId = `${formName}-${_xform_id_string}`; //dataset uuid
    state.data = cleanedSubmission;

    // ===========================================================================
    //  NOTE: These job mappings assume a specific Kobo form metadata naming syntax!
    //  'NR' and 'BNS matrix' questions should follow the naming conventions below
    //  See Docs to learn more about the assumptions made here.
    // ===========================================================================
    // If a partner creates a form with slightly different field names, this
    // section will need to be updated by WCS. If future forms are being designed,
    // we'd recommend using a repeat group that allows the partner to select the
    // type of 'nr' or 'matrix' they're reporting on. The current approach treats
    // the form field names in Kobo _AS_ data themselves.
    state.nr = Object.keys(state.data)
      .filter(key => key.startsWith('nr/'))
      .map(key => ({
        DatasetUuidId: state.data.datasetId,
        AnswerId: state.data._id,
        Id: state.data._id,
        LastUpdate: new Date().toISOString(),
        Nr: key.substring(3),
        NrCollect: state.data[key],
      }));

    const matrix = Object.keys(state.data)
      .filter(key => key.includes('bns_matrix_'))
      .map(key => {
        const item = key.substring(
          key.lastIndexOf('bns_matrix_') + 'bns_matrix_'.length,
          key.lastIndexOf('_')
        );
        return {
          Dataset_Id: state.data.datasetId, //DatasetUuidId
          //Id: state.data._id,
          AnswerId: state.data._id,
          gs: item.replace(/_/g, ' '),
          have:
            state.data[
              `hh_assets/bns_matrix_${item}/bns_matrix_${item}_possess`
            ] || state.data[`bns_matrix_${item}/bns_matrix_${item}_possess`],
          necessary:
            state.data[
              `hh_assets/bns_matrix_${item}/bns_matrix_${item}_necessary`
            ] || state.data[`bns_matrix_${item}/bns_matrix_${item}_necessary`],
          quantity:
            state.data[
              `hh_assets/bns_matrix_${item}/bns_matrix_${item}_number`
            ] || state.data[`bns_matrix_${item}/bns_matrix_${item}_number`],
        };
      });

    state.matrix = [...new Set(matrix)];
    // ===========================================================================
    console.log(`bns_matrix to upload...: ${JSON.stringify(state.matrix)}`);
    return state;
  } catch (error) {
    state.connection.close();
    throw error;
  }
});

upsert('WCSPROGRAMS_KoboBnsAnswer', 'AnswerId', {
  DatasetUuidId: dataValue('datasetId'),
  //Id: dataValue('durableUUID'), //Q: does not exist, to add for consistency?
  SubmissionUuid: dataValue('_uuid'),
  AnswerId: dataValue('_id'),
  LastUpdate: new Date().toISOString(),
  SurveyDate: state =>
    state.data.today ? state.data.today : state.data._submission_time,
  Landscape: dataValue('landscape'),
  Surveyor: dataValue('surveyor'),
  Participant: dataValue('participant'),
  Arrival: dataValue('arrival'),
  District: dataValue('district'),
  Village: dataValue('village'),
  HhId: dataValue('hh_id'),
  BenefProject: dataValue('benef_project'),
  HhTypeControl: state => (state.data.hh_type === 'control' ? 1 : 0),
  HhTypeOrgBenef: state => (state.data.hh_type === 'wcs_benef' ? 1 : 0),
  HhTypeOtherBenef: state => (state.data.hh_type === 'other_benef' ? 1 : 0),
  ExplainProject: dataValue('explain_project'),
  KnowPa: dataValue('know_PA'),
  BenefPa: dataValue('benef_PA'),
  ExplainBenefPa: dataValue('explain_benef_PA'),
  Livelihood1: dataValue('livelihoods/l1'),
  Livelihood2: dataValue('livelihoods/l2'),
  Livelihood3: dataValue('livelihoods/l3'),
  Livelihood4: dataValue('livelihoods/l4'),
  BnsPlus: dataValue('bns_plus'),
});

// Refactor this for scale so it doesn't perform a no-op delete 9/10 times.
// Maybe check result of previous op, then only delete if it was an update.
sql({
  query: state =>
    `DELETE FROM WCSPROGRAMS_KoboBnsAnswerhhmembers where AnswerId = '${state.data._id}'`,
});
insert('WCSPROGRAMS_KoboBnsAnswerhhmembers', {
  //insert hh head first
  DatasetUuidId: dataValue('datasetId'),
  Id: dataValue('_id'),
  AnswerId: dataValue('_id'),
  Head: dataValue('gender_head') ? '1' : '0',
  Gender: dataValue('gender_head'),
  Ethnicity: dataValue('ethnicity_head'),
  Birth: state => {
    var birth = dataValue('birth_head')(state);
    return birth ? parseInt(birth.substring(0, 4)) : null;
  },
  LastUpdate: new Date().toISOString(),
});

alterState(state => {
  if (state.data.hh_members) {
    return insertMany('WCSPROGRAMS_KoboBnsAnswerhhmembers', (
      state //then insert other members
    ) =>
      state.data.hh_members.map(member => ({
        DatasetUuidId: state.data.datasetId,
        Id: state.data._id,
        AnswerId: state.data._id,
        Head: '0',
        Gender: member[`hh_members/gender`],
        Ethnicity: member[`hh_members/ethnicity`],
        Birth: parseInt(member[`hh_members/birth`].substring(0, 4)),
        LastUpdate: new Date().toISOString(),
      }))
    )(state);
  }

  console.log('No household members found.');
  return state;
});

// Refactor this for scale so it doesn't perform a no-op delete 9/10 times.
// Maybe check result of previous op, then only delete if it was an update.
sql({
  query: state =>
    `DELETE FROM WCSPROGRAMS_KoboBnsAnswernr where AnswerId = '${state.data._id}'`,
});
alterState(state => {
  if (state.nr && state.nr.length > 0) {
    return insertMany('WCSPROGRAMS_KoboBnsAnswernr', state => state.nr)(state);
  }

  console.log('No natural resource found.');
  return state;
});

// Refactor this for scale so it doesn't perform a no-op delete 9/10 times.
// Maybe check result of previous op, then only delete if it was an update.
//sql({ query: state => `DELETE FROM WCSPROGRAMS_KoboBnsAnswergs where AnswerId = '${state.data._id}'` }); //ERROR: AnswerId does not exist
sql({
  query: state =>
    `DELETE FROM WCSPROGRAMS_KoboBnsAnswerGS where AnswerId = '${state.data._id}'`,
});
alterState(state => {
  if (state.matrix && state.matrix.length > 0) {
    return insertMany(
      'WCSPROGRAMS_KoboBnsAnswerGS',
      state => state.matrix
    )(state);
  }

  console.log('No matrix found.');
  return state;
});

upsert('WCSPROGRAMS_KoboBnsAnswergps', 'AnswerId', {
  DatasetUuidId: dataValue('datasetId'), //Q: Add new column
  AnswerId: dataValue('_id'),
  Id: dataValue('_id'),
  Geom: dataValue('_geolocation'),
  Lat: dataValue('gps/lat'),
  Long: dataValue('gps/long'),
  LastUpdate: new Date().toISOString(),
});

upsert('WCSPROGRAMS_KoboData', 'DatasetUuidId', {
  //renamed from DatasetUuid
  //AnswerId: dataValue('_id'), //KoboData = 1 Dataset (not 1 survey)
  DatasetName: state.data.formName,
  DatasetOwner: state.data.formOwner,
  DatasetUuidId: dataValue('datasetId'),
  DatasetYear: new Date().getFullYear(),
  LastSubmissionTime: dataValue('_submission_time'),
  LastCheckedTime: dataValue('_submission_time'),
  LastUpdateTime: new Date().toISOString(),
  KoboManaged: true,
  Tags: dataValue('_tags'),
});
