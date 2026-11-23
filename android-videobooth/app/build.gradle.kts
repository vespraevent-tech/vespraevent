plugins { id("com.android.application") }

android {
    namespace = "com.vespraevent.videobooth"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.vespraevent.videobooth"
        minSdk = 24
        targetSdk = 34
        versionCode = 2
        versionName = "1.0.1"
    }
    /* Signature : la clé n'est jamais dans le code. Elle vient de variables d'environnement au moment de compiler. */
    val ks = System.getenv("VB_KEYSTORE")
    if (ks != null) {
        signingConfigs.create("vespra") {
            storeFile = file(ks)
            storePassword = System.getenv("VB_KEYSTORE_PASS")
            keyAlias = System.getenv("VB_KEY_ALIAS") ?: "vespra"
            keyPassword = System.getenv("VB_KEYSTORE_PASS")
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            if (ks != null) signingConfig = signingConfigs.getByName("vespra")
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
}
