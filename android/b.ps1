# מחיקת תיקיות build ישנות
Remove-Item -Recurse -Force .\.cxx
Remove-Item -Recurse -Force .\build
Remove-Item -Recurse -Force ..\node_modules\react-native-reanimated\android\.cxx
Remove-Item -Recurse -Force ..\node_modules\react-native-reanimated\android\build

# ניקוי גריידל
./gradlew clean

# בנייה מחדש
./gradlew assembleRelease
