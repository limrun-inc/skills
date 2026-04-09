# Xcode Project Template

Replace ALL occurrences of `__APP_NAME__` with the actual app name (PascalCase, no spaces or hyphens).

## Directory Structure

```
__APP_NAME__/
  __APP_NAME__.xcodeproj/
    project.pbxproj
    project.xcworkspace/
      contents.xcworkspacedata
  __APP_NAME__/
    __APP_NAME__App.swift
    ContentView.swift
    Assets.xcassets/
      Contents.json
      AppIcon.appiconset/
        Contents.json
      AccentColor.colorset/
        Contents.json
```

## File: `__APP_NAME__.xcodeproj/project.pbxproj`

```
// !$*UTF8*$!
{
	archiveVersion = 1;
	classes = {
	};
	objectVersion = 77;
	objects = {

/* Begin PBXFileReference section */
		8A0C3A6E2F1A57C100ADB008 /* __APP_NAME__.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = "__APP_NAME__.app"; sourceTree = BUILT_PRODUCTS_DIR; };
/* End PBXFileReference section */

/* Begin PBXFileSystemSynchronizedRootGroup section */
		8A0C3A702F1A57C100ADB008 /* __APP_NAME__ */ = {
			isa = PBXFileSystemSynchronizedRootGroup;
			path = "__APP_NAME__";
			sourceTree = "<group>";
		};
/* End PBXFileSystemSynchronizedRootGroup section */

/* Begin PBXFrameworksBuildPhase section */
		8A0C3A6B2F1A57C100ADB008 /* Frameworks */ = {
			isa = PBXFrameworksBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXFrameworksBuildPhase section */

/* Begin PBXGroup section */
		8A0C3A652F1A57C100ADB008 = {
			isa = PBXGroup;
			children = (
				8A0C3A702F1A57C100ADB008 /* __APP_NAME__ */,
				8A0C3A6F2F1A57C100ADB008 /* Products */,
			);
			sourceTree = "<group>";
		};
		8A0C3A6F2F1A57C100ADB008 /* Products */ = {
			isa = PBXGroup;
			children = (
				8A0C3A6E2F1A57C100ADB008 /* __APP_NAME__.app */,
			);
			name = Products;
			sourceTree = "<group>";
		};
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
		8A0C3A6D2F1A57C100ADB008 /* __APP_NAME__ */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = 8A0C3A792F1A57C300ADB008 /* Build configuration list for PBXNativeTarget "__APP_NAME__" */;
			buildPhases = (
				8A0C3A6A2F1A57C100ADB008 /* Sources */,
				8A0C3A6B2F1A57C100ADB008 /* Frameworks */,
				8A0C3A6C2F1A57C100ADB008 /* Resources */,
			);
			buildRules = (
			);
			dependencies = (
			);
			fileSystemSynchronizedGroups = (
				8A0C3A702F1A57C100ADB008 /* __APP_NAME__ */,
			);
			name = "__APP_NAME__";
			packageProductDependencies = (
			);
			productName = "__APP_NAME__";
			productReference = 8A0C3A6E2F1A57C100ADB008 /* __APP_NAME__.app */;
			productType = "com.apple.product-type.application";
		};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
		8A0C3A662F1A57C100ADB008 /* Project object */ = {
			isa = PBXProject;
			attributes = {
				BuildIndependentTargetsInParallel = 1;
				LastSwiftUpdateCheck = 2620;
				LastUpgradeCheck = 2620;
				TargetAttributes = {
					8A0C3A6D2F1A57C100ADB008 = {
						CreatedOnToolsVersion = 26.2;
					};
				};
			};
			buildConfigurationList = 8A0C3A692F1A57C100ADB008 /* Build configuration list for PBXProject "__APP_NAME__" */;
			developmentRegion = en;
			hasScannedForEncodings = 0;
			knownRegions = (
				en,
				Base,
			);
			mainGroup = 8A0C3A652F1A57C100ADB008;
			minimizedProjectReferenceProxies = 1;
			preferredProjectObjectVersion = 77;
			productRefGroup = 8A0C3A6F2F1A57C100ADB008 /* Products */;
			projectDirPath = "";
			projectRoot = "";
			targets = (
				8A0C3A6D2F1A57C100ADB008 /* __APP_NAME__ */,
			);
		};
/* End PBXProject section */

/* Begin PBXResourcesBuildPhase section */
		8A0C3A6C2F1A57C100ADB008 /* Resources */ = {
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXResourcesBuildPhase section */

/* Begin PBXSourcesBuildPhase section */
		8A0C3A6A2F1A57C100ADB008 /* Sources */ = {
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXSourcesBuildPhase section */

/* Begin XCBuildConfiguration section */
		8A0C3A772F1A57C300ADB008 /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				DEBUG_INFORMATION_FORMAT = dwarf;
				GCC_PREPROCESSOR_DEFINITIONS = (
					"DEBUG=1",
					"$(inherited)",
				);
				IPHONEOS_DEPLOYMENT_TARGET = 18.0;
				ONLY_ACTIVE_ARCH = YES;
				SDKROOT = iphoneos;
				SWIFT_ACTIVE_COMPILATION_CONDITIONS = "DEBUG $(inherited)";
				SWIFT_OPTIMIZATION_LEVEL = "-Onone";
			};
			name = Debug;
		};
		8A0C3A782F1A57C300ADB008 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
				IPHONEOS_DEPLOYMENT_TARGET = 18.0;
				SDKROOT = iphoneos;
				SWIFT_COMPILATION_MODE = wholemodule;
				VALIDATE_PRODUCT = YES;
			};
			name = Release;
		};
		8A0C3A7A2F1A57C300ADB008 /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
				ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				ENABLE_PREVIEWS = YES;
				GENERATE_INFOPLIST_FILE = YES;
				INFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES;
				INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents = YES;
				INFOPLIST_KEY_UILaunchScreen_Generation = YES;
				INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = "UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
				INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone = "UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
				IPHONEOS_DEPLOYMENT_TARGET = 18.0;
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				MARKETING_VERSION = 1.0;
				PRODUCT_BUNDLE_IDENTIFIER = "com.app.__APP_NAME__";
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_EMIT_LOC_STRINGS = YES;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Debug;
		};
		8A0C3A7B2F1A57C300ADB008 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
				ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				ENABLE_PREVIEWS = YES;
				GENERATE_INFOPLIST_FILE = YES;
				INFOPLIST_KEY_UIApplicationSceneManifest_Generation = YES;
				INFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents = YES;
				INFOPLIST_KEY_UILaunchScreen_Generation = YES;
				INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = "UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
				INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone = "UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
				IPHONEOS_DEPLOYMENT_TARGET = 18.0;
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				MARKETING_VERSION = 1.0;
				PRODUCT_BUNDLE_IDENTIFIER = "com.app.__APP_NAME__";
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_EMIT_LOC_STRINGS = YES;
				SWIFT_VERSION = 5.0;
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Release;
		};
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
		8A0C3A692F1A57C100ADB008 /* Build configuration list for PBXProject "__APP_NAME__" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				8A0C3A772F1A57C300ADB008 /* Debug */,
				8A0C3A782F1A57C300ADB008 /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
		8A0C3A792F1A57C300ADB008 /* Build configuration list for PBXNativeTarget "__APP_NAME__" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				8A0C3A7A2F1A57C300ADB008 /* Debug */,
				8A0C3A7B2F1A57C300ADB008 /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
/* End XCConfigurationList section */
	};
	rootObject = 8A0C3A662F1A57C100ADB008 /* Project object */;
}
```

## File: `__APP_NAME__.xcodeproj/project.xcworkspace/contents.xcworkspacedata`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Workspace
   version = "1.0">
   <FileRef
      location = "self:">
   </FileRef>
</Workspace>
```

## File: `__APP_NAME__/Assets.xcassets/Contents.json`

```json
{
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
```

## File: `__APP_NAME__/Assets.xcassets/AppIcon.appiconset/Contents.json`

```json
{
  "images" : [
    {
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    },
    {
      "appearances" : [
        {
          "appearance" : "luminosity",
          "value" : "dark"
        }
      ],
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    },
    {
      "appearances" : [
        {
          "appearance" : "luminosity",
          "value" : "tinted"
        }
      ],
      "idiom" : "universal",
      "platform" : "ios",
      "size" : "1024x1024"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
```

## File: `__APP_NAME__/Assets.xcassets/AccentColor.colorset/Contents.json`

```json
{
  "colors" : [
    {
      "idiom" : "universal"
    }
  ],
  "info" : {
    "author" : "xcode",
    "version" : 1
  }
}
```

## File: `__APP_NAME__/__APP_NAME__App.swift`

```swift
import SwiftUI

@main
struct __APP_NAME__App: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

## File: `__APP_NAME__/ContentView.swift`

```swift
import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack {
            Image(systemName: "globe")
                .imageScale(.large)
                .foregroundStyle(.tint)
            Text("Hello, world!")
        }
        .padding()
    }
}
```

## Notes

- The `PBXFileSystemSynchronizedRootGroup` in `project.pbxproj` means Xcode auto-discovers all `.swift` files in the `__APP_NAME__/` source directory. You do NOT need to modify `project.pbxproj` when adding new Swift files.
- The `GENERATE_INFOPLIST_FILE = YES` setting means Xcode auto-generates `Info.plist` — you don't need to create one.
- `IPHONEOS_DEPLOYMENT_TARGET` is set to `18.0` — use iOS 18+ APIs freely.
- The bundle identifier defaults to `com.app.__APP_NAME__`. Adjust if needed.
- No `DEVELOPMENT_TEAM` is set — the Limrun sandbox handles code signing for simulator builds.
