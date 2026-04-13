<<<<<<< Updated upstream
import {Text, View} from 'react-native'

export default function App() {
  return (
    <View>
      <Text>Olá mundo!</Text>
    </View>
  )
=======
import { Redirect } from "expo-router";

export default function Index() {
  return <Redirect href="/auth/login" />;
>>>>>>> Stashed changes
}