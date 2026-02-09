import { registerRootComponent } from 'expo';
import '../web/global.css';
import App from '../app/_layout';

// registerRootComponent calls AppRegistry.registerComponent with 'main' as the app key
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
