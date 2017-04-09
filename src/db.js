// using firebase realtime database since it is simple to implement
// deals only in json objects and hence makes it simpler to use
import * as admin from 'firebase-admin';
import serviceAccount from '../firebase-admin-sdk.json';

export default callback => {
	// connect to a database if needed, then pass it to `callback`:
	admin.initializeApp({
		credential: admin.credential.cert(serviceAccount),
		databaseURL: 'https://server-stats.firebaseio.com'
	});

	callback(admin.database());
}
