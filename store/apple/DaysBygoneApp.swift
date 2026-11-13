// DaysBygoneApp.swift — точка входа приложения.
// Файл создаётся Xcode автоматически при «New Project» с именем <Проект>App.swift —
// замените его содержимое этим.

import SwiftUI
import UIKit

@main
struct DaysBygoneApp: App {
    // без этого адаптера AppDelegate не регистрируется и блокировка ориентации не работает
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
                .onAppear { lockOrientations() }
        }
    }

    /// Игра строго ландшафтная (как в Android-манифесте: screenOrientation="landscape").
    private func lockOrientations() {
        if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene {
            scene.requestGeometryUpdate(.iOS(interfaceOrientations: .landscape))
        }
        UIDevice.current.setValue(UIInterfaceOrientation.landscapeRight.rawValue,
                                  forKey: "orientation")
    }
}

// Разрешаем только ландшафт на уровне приложения.
final class AppDelegate: NSObject, UIApplicationDelegate {
    static var orientationLock: UIInterfaceOrientationMask = .landscape

    func application(_ application: UIApplication,
                     supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        AppDelegate.orientationLock
    }
}
