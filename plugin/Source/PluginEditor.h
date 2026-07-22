#pragma once

#include <JuceHeader.h>
#include "PluginProcessor.h"

class OphanimAudioProcessorEditor  : public juce::AudioProcessorEditor
{
public:
    OphanimAudioProcessorEditor (OphanimAudioProcessor&);
    ~OphanimAudioProcessorEditor() override;

    void paint (juce::Graphics&) override;
    void resized() override;

private:
    OphanimAudioProcessor& audioProcessor;

    // JUCE 8 Webview Component
    juce::WebBrowserComponent webView;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR (OphanimAudioProcessorEditor)
};
