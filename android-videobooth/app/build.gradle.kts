plugins { id("com.android.application") }

android {
    namespace = "com.vespraevent.videobooth"
    compileSdk = 34
    defaultConfig {
        applicationId = "com.vespraevent.videobooth"
        minSdk = 24
        targetSdk = 34
        versionCode = 4
        versionName = "1.1.0"
        /* clé d'application : fournie au moment de compiler (jamais dans le dépôt) ; le site n'en garde que l'empreinte */
        val cleApp = System.getenv("VB_APP_KEY") ?: throw GradleException("Variable VB_APP_KEY manquante (clé d'application)")
        buildConfigField("String", "APP_KEY", "\"$cleApp\"")
    }
    buildFeatures { buildConfig = true }
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
