#include "PluginProcessor.h"
#include "PluginEditor.h"

static std::optional<juce::WebBrowserComponent::Resource> getWebResource (const juce::String& urlPath)
{
    juce::File currentExe = juce::File::getSpecialLocation (juce::File::SpecialLocationType::currentExecutableFile);
    
    // Check inside plugin bundle: Ophanim.vst3/Contents/Resources/web or Ophanim.component/Contents/Resources/web
    juce::File webDir = currentExe.getParentDirectory().getParentDirectory().getChildFile ("Resources/web");

    if (!webDir.exists())
        webDir = currentExe.getParentDirectory().getChildFile ("resources/web");

    if (!webDir.exists())
    {
        webDir = juce::File::getSpecialLocation (juce::File::SpecialLocationType::userHomeDirectory)
                     .getChildFile ("Library/Audio/Plug-Ins/VST3/Ophanim.vst3/Contents/Resources/web");
    }

    if (!webDir.exists())
    {
        webDir = juce::File ("/Library/Audio/Plug-Ins/VST3/Ophanim.vst3/Contents/Resources/web");
    }

    juce::String relativePath = urlPath;
    if (relativePath.startsWith ("/") || relativePath.startsWith ("\\"))
        relativePath = relativePath.substring (1);

    if (relativePath.isEmpty() || relativePath == "/")
        relativePath = "index.html";

    int queryIdx = relativePath.indexOfChar ('?');
    if (queryIdx >= 0)
        relativePath = relativePath.substring (0, queryIdx);
    
    int hashIdx = relativePath.indexOfChar ('#');
    if (hashIdx >= 0)
        relativePath = relativePath.substring (0, hashIdx);

    juce::File targetFile = webDir.getChildFile (relativePath);
    if (!targetFile.existsAsFile())
        return std::nullopt;

    juce::MemoryBlock mb;
    if (!targetFile.loadFileAsData (mb))
        return std::nullopt;

    juce::String mimeType = "text/html";
    if (targetFile.hasFileExtension ("js")) mimeType = "text/javascript";
    else if (targetFile.hasFileExtension ("css")) mimeType = "text/css";
    else if (targetFile.hasFileExtension ("svg")) mimeType = "image/svg+xml";
    else if (targetFile.hasFileExtension ("png")) mimeType = "image/png";
    else if (targetFile.hasFileExtension ("jpg") || targetFile.hasFileExtension ("jpeg")) mimeType = "image/jpeg";
    else if (targetFile.hasFileExtension ("json")) mimeType = "application/json";
    else if (targetFile.hasFileExtension ("woff2")) mimeType = "font/woff2";

    std::vector<std::byte> bytes (mb.getSize());
    std::memcpy (bytes.data(), mb.getData(), mb.getSize());

    return juce::WebBrowserComponent::Resource { std::move (bytes), mimeType };
}

OphanimAudioProcessorEditor::OphanimAudioProcessorEditor (OphanimAudioProcessor& p)
    : AudioProcessorEditor (&p), audioProcessor (p),
      webView (juce::WebBrowserComponent::Options()
                   .withBackend (juce::WebBrowserComponent::Options::Backend::defaultBackend)
                   .withResourceProvider ([] (const juce::String& url) {
                       return getWebResource (url);
                   })
                   .withWinWebView2Options (juce::WebBrowserComponent::Options::WinWebView2()
                                                .withUserDataFolder (juce::File::getSpecialLocation (juce::File::SpecialLocationType::tempDirectory))))
{
    addAndMakeVisible (webView);

    // If local bundle web resources exist, load via JUCE ResourceProvider
    if (getWebResource ("index.html").has_value())
    {
        webView.goToURL (juce::WebBrowserComponent::getResourceProviderRoot());
    }
    else
    {
        // Fallback to local dev server if running in live dev mode
        webView.goToURL ("http://localhost:8443");
    }

    setSize (1024, 720);
    setResizable (true, true);
}


OphanimAudioProcessorEditor::~OphanimAudioProcessorEditor()
{
}

void OphanimAudioProcessorEditor::paint (juce::Graphics& g)
{
    g.fillAll (juce::Colour (0xff0a0b0e));
}

void OphanimAudioProcessorEditor::resized()
{
    webView.setBounds (getLocalBounds());
}
